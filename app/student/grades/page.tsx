'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, RefreshCw } from 'lucide-react'
import { supabaseStudent } from '@/lib/supabase-student'

type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
}

type ClassRelation = {
  id: string
  section?: string | null
  grade_level?: string | null
  subjects: SubjectRow | null
}

type GradeRow = {
  id: string
  class_id: string
  school_year: string
  semester: string
  grading_period: GradingPeriod
  grade: number
  remarks: string | null
  classes: ClassRelation | null
}

type RawClassRelation = {
  id: string
  section?: string | null
  grade_level?: string | null
  subjects: SubjectRow[] | SubjectRow | null
}

type RawGradeRow = {
  id: string
  class_id: string
  school_year: string
  semester: string
  grading_period: GradingPeriod
  grade: number
  remarks: string | null
  classes: RawClassRelation[] | RawClassRelation | null
}

type SubmissionRow = {
  class_id: string
  school_year: string
  term: string
  grading_period: GradingPeriod
  is_submitted: boolean
}

type TableRow = {
  key: string
  classId: string
  schoolYear: string
  semester: string
  subjectCode: string
  subjectName: string
  year: string
  section: string
  grade: number | null
  remarks: string
  teacherRemark: string | null
}

const PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function formatGrade(value: number | null) {
  if (value === null) return '—'
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function getComputedRemarks(grade: number | null) {
  if (grade === null) return 'Pending'
  if (grade >= 98) return 'With Highest Honors'
  if (grade >= 95) return 'With High Honors'
  if (grade >= 90) return 'With Honors'
  if (grade >= 75) return 'Passed'
  return 'Failed'
}

function getRemarksClass(remarks: string) {
  if (
    remarks === 'With Highest Honors' ||
    remarks === 'With High Honors' ||
    remarks === 'With Honors'
  ) {
    return 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200'
  }

  if (remarks === 'Passed') {
    return 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200'
  }

  if (remarks === 'Pending') {
    return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  }

  return 'bg-red-100 text-red-700 ring-1 ring-red-200'
}

function getSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeClassRelation(
  value: RawClassRelation[] | RawClassRelation | null | undefined
): ClassRelation | null {
  const rawClass = getSingleRelation(value)
  if (!rawClass) return null

  return {
    id: rawClass.id,
    section: rawClass.section ?? null,
    grade_level: rawClass.grade_level ?? null,
    subjects: getSingleRelation(rawClass.subjects),
  }
}

function normalizeGradeRow(row: RawGradeRow): GradeRow {
  return {
    id: row.id,
    class_id: row.class_id,
    school_year: row.school_year,
    semester: row.semester,
    grading_period: row.grading_period,
    grade: Number(row.grade),
    remarks: row.remarks,
    classes: normalizeClassRelation(row.classes),
  }
}

export default function StudentGradesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('All')
  const [selectedPeriod, setSelectedPeriod] = useState<GradingPeriod>('1st')

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError('')

        const {
          data: { user },
        } = await supabaseStudent.auth.getUser()

        if (!user) throw new Error('No authenticated user found.')

        const { data: studentData, error: studentError } = await supabaseStudent
          .from('students')
          .select('id')
          .eq('profile_id', user.id)
          .single()

        if (studentError || !studentData) {
          throw new Error('Student record not found.')
        }

        const { data: gradesData, error: gradesError } = await supabaseStudent
          .from('grades')
          .select(`
            id,
            class_id,
            school_year,
            semester,
            grading_period,
            grade,
            remarks,
            classes (
              id,
              section,
              grade_level,
              subjects (
                id,
                subject_code,
                subject_name
              )
            )
          `)
          .eq('student_id', studentData.id)
          .order('school_year', { ascending: false })
          .order('semester', { ascending: true })
          .order('grading_period', { ascending: true })

        if (gradesError) throw gradesError

        const safeGrades = ((gradesData ?? []) as RawGradeRow[]).map(normalizeGradeRow)
        const classIds = [...new Set(safeGrades.map((item) => item.class_id))]

        let safeSubmissions: SubmissionRow[] = []

        if (classIds.length > 0) {
          const { data: submissionData, error: submissionError } = await supabaseStudent
            .from('grade_submissions')
            .select(`
              class_id,
              school_year,
              term,
              grading_period,
              is_submitted
            `)
            .in('class_id', classIds)
            .eq('is_submitted', true)

          if (submissionError) throw submissionError
          safeSubmissions = (submissionData as SubmissionRow[]) || []
        }

        if (!mounted) return

        setGrades(safeGrades)
        setSubmissions(safeSubmissions)

        const years = [...new Set(safeGrades.map((item) => item.school_year))]
        if (years.length > 0) {
          setSelectedSchoolYear(years[0])
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load grades.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [])

  const schoolYears = useMemo(() => {
    return ['All', ...new Set(grades.map((item) => item.school_year))]
  }, [grades])

  const tableRows = useMemo(() => {
  const submittedSet = new Set(
    submissions.map(
      (item) =>
        `${item.class_id}|${item.school_year}|${item.term}|${item.grading_period}`
    )
  )

const filteredGrades =
  selectedSchoolYear === 'All'
    ? grades
    : grades.filter((item) => {
        const matchYear = item.school_year === selectedSchoolYear

        const validForSelectedPeriod =
          (selectedPeriod === '1st' && item.semester === '1st Semester' && (item.grading_period === '1st' || item.grading_period === '2nd')) ||
          (selectedPeriod === '2nd' && item.semester === '1st Semester' && (item.grading_period === '1st' || item.grading_period === '2nd')) ||
          (selectedPeriod === '3rd' && item.semester === '2nd Semester' && (item.grading_period === '3rd' || item.grading_period === '4th')) ||
          (selectedPeriod === '4th' && item.semester === '2nd Semester' && (item.grading_period === '3rd' || item.grading_period === '4th'))

        return matchYear && validForSelectedPeriod
      })

  const map = new Map<string, TableRow>()

  for (const item of filteredGrades) {
    const semester = item.semester
    const period = item.grading_period

 
    const isValidPeriod =
      (semester === '1st Semester' && (period === '1st' || period === '2nd')) ||
      (semester === '2nd Semester' && (period === '3rd' || period === '4th'))

    if (!isValidPeriod) {
      continue
    }

    // One row per class per semester ONLY
   const rowKey = `${item.class_id}|${item.school_year}|${semester}|${period}`

    if (!map.has(rowKey)) {
  map.set(rowKey, {
    key: rowKey,
    classId: item.class_id,
    schoolYear: item.school_year,
    semester,
    subjectCode: item.classes?.subjects?.subject_code || '—',
    subjectName: item.classes?.subjects?.subject_name || 'Unnamed Subject',
    year: item.classes?.grade_level || '—',
    section: item.classes?.section || '—',
    grade: item.grade ?? null,
    remarks: item.grade ? getComputedRemarks(item.grade) : 'Pending',
    teacherRemark: item.remarks ?? null,
  })
}

    const submissionKey =
      `${item.class_id}|${item.school_year}|${semester}|${period}`

    const isSubmitted = submittedSet.has(submissionKey)

    if (!isSubmitted) continue

    const row = map.get(rowKey)!

    row.grade = item.grade
    row.teacherRemark = item.remarks
    row.remarks = getComputedRemarks(item.grade)
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.schoolYear !== b.schoolYear) {
      return b.schoolYear.localeCompare(a.schoolYear)
    }

    if (a.year !== b.year) {
      return a.year.localeCompare(b.year)
    }

    if (a.section !== b.section) {
      return a.section.localeCompare(b.section)
    }

    return a.subjectName.localeCompare(b.subjectName)
  })
}, [grades, submissions, selectedSchoolYear, selectedPeriod])

  if (loading) {
    return (
      <div className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-cyan-900">Loading grades...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Error</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-cyan-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-700">Qorban Portal</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
              Report of Grades
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              View your released grades by school year and grading period.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="h-11 rounded-2xl border border-cyan-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-cyan-500"
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year === 'All' ? 'All School Years' : year}
                </option>
              ))}
            </select>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as GradingPeriod)}
              className="h-11 rounded-2xl border border-cyan-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none focus:border-cyan-500"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period} Period
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-white text-cyan-700 transition hover:bg-cyan-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-xl bg-rose-100 p-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-rose-800">Warning</h2>
            <p className="mt-1 text-sm leading-6 text-rose-700">
              Only grades from submitted grading periods are shown in this report.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border-2 border-dashed border-violet-300 bg-violet-50 p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-xl bg-violet-100 p-2 text-violet-700">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-violet-800">Note</h2>
            <p className="mt-1 text-sm leading-6 text-violet-700">
              Remarks are computed from the selected grading period only.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-cyan-100 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-bold text-slate-900">
            {selectedPeriod} Period Grade Report
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            School-year based table from your submitted grade records.
          </p>
        </div>

        {tableRows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-500">No grades found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-4 text-left font-bold">#</th>
                  <th className="px-4 py-4 text-left font-bold">Code</th>
                  <th className="px-4 py-4 text-left font-bold">Descriptive</th>
                  <th className="px-4 py-4 text-center font-bold">Year</th>
                  <th className="px-4 py-4 text-center font-bold">Section</th>
                  <th className="px-4 py-4 text-center font-bold">{selectedPeriod}</th>
                  <th className="px-4 py-4 text-center font-bold">Remarks</th>
                </tr>
              </thead>

              <tbody>
                {tableRows.map((row, index) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-100 transition hover:bg-cyan-50/40"
                  >
                    <td className="px-4 py-4 align-top text-slate-500">{index + 1}.</td>

                    <td className="px-4 py-4 align-top font-semibold text-slate-700">
                      {row.subjectCode}
                    </td>

                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-900">{row.subjectName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.schoolYear} • {row.semester}
                      </div>
                      {row.teacherRemark ? (
                        <div className="mt-1 text-xs text-slate-500">
                          Teacher note: {row.teacherRemark}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-center font-medium text-slate-700">
                      {row.year}
                    </td>

                    <td className="px-4 py-4 text-center font-medium text-slate-700">
                      {row.section}
                    </td>

                    <td className="px-4 py-4 text-center font-extrabold text-cyan-700">
                      {formatGrade(row.grade)}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getRemarksClass(
                          row.remarks
                        )}`}
                      >
                        {row.remarks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}