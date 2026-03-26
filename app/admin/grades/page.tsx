'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LockOpen, RefreshCw, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'

type AcademicYearRow = {
  id: string
  school_year: string
  is_active: boolean
}

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
}

type TeacherRow = {
  id: string
  teacher_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
}

type ClassRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  school_year: string
  semester: Semester
  is_active: boolean
  subjects: SubjectRow | null
  teachers: TeacherRow | null
}

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type GradeRow = {
  class_id: string
  student_id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
}

type GradeSubmissionRow = {
  id: string
  class_id: string
  teacher_id: string
  school_year: string
  term: Semester
  grading_period: GradingPeriod
  is_submitted: boolean
  submitted_at: string | null
}

type GradingWindowRow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
}

type AdminGradeRow = {
  rowKey: string
  classId: string
  submissionId: string | null
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  semester: Semester
  teacherName: string
  teacherNo: string
  totalStudents: number
  encodedStudents: number
  progress: number
  isSubmitted: boolean
  submittedAt: string | null
}

const PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Unassigned Teacher'
  return [teacher.first_name, teacher.middle_name, teacher.last_name, teacher.suffix]
    .filter(Boolean)
    .join(' ')
}

function getCurrentWindow(windows: GradingWindowRow[]) {
  const order = (w: GradingWindowRow) => {
    const semesterValue = w.semester === '1st Semester' ? 0 : 10
    const periodValue = PERIODS.indexOf(w.grading_period) + 1
    return semesterValue + periodValue
  }

  return (
    windows
      .filter((w) => w.is_open && !w.is_locked)
      .sort((a, b) => order(a) - order(b))[0] ||
    windows.filter((w) => w.is_open).sort((a, b) => order(a) - order(b))[0] ||
    windows.sort((a, b) => order(a) - order(b))[0] ||
    null
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string
  value: string | number
  subtitle: string
}) {
  return (
    <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-green-950">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-green-700 transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export default function AdminGradesPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reopeningId, setReopeningId] = useState<string | null>(null)

  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [schoolYear, setSchoolYear] = useState('')
  const [gradingPeriod, setGradingPeriod] = useState<GradingPeriod>('1st')
  const [currentSemester, setCurrentSemester] = useState<Semester>('1st Semester')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AdminGradeRow[]>([])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) =>
      [
        row.subjectName,
        row.subjectCode,
        row.gradeLevel,
        row.section,
        row.semester,
        row.teacherName,
        row.teacherNo,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [rows, search])

  const summary = useMemo(() => {
    const totalClasses = filteredRows.length
    const submitted = filteredRows.filter((row) => row.isSubmitted).length
    const editable = filteredRows.filter((row) => !row.isSubmitted).length
    const averageProgress =
      totalClasses > 0
        ? Math.round(filteredRows.reduce((sum, row) => sum + row.progress, 0) / totalClasses)
        : 0

    return { totalClasses, submitted, editable, averageProgress }
  }, [filteredRows])

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message)
      return
    }

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)
    if (yearRows.length > 0) {
      const active = yearRows.find((row) => row.is_active)
      setSchoolYear((prev) => prev || active?.school_year || yearRows[0].school_year)
    }
  }

  const loadCurrentPeriod = async (selectedYear: string) => {
    if (!selectedYear) return

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', selectedYear)

    if (error) {
      toast.error(error.message)
      return
    }

    const current = getCurrentWindow((data ?? []) as GradingWindowRow[])
    if (current) {
      setGradingPeriod(current.grading_period)
      setCurrentSemester(current.semester)
    }
  }

  const loadRows = async (selectedYear: string, selectedPeriod: GradingPeriod) => {
    if (!selectedYear) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id,
          subject_id,
          teacher_id,
          grade_level,
          section,
          school_year,
          semester,
          is_active,
          subjects:subject_id (
            id,
            subject_code,
            subject_name
          ),
          teachers:teacher_id (
            id,
            teacher_no,
            first_name,
            middle_name,
            last_name,
            suffix
          )
        `)
        .eq('school_year', selectedYear)
        .eq('is_active', true)

      if (classesError) throw classesError

      const classes = (classesData ?? []) as ClassRow[]
      if (classes.length === 0) {
        setRows([])
        return
      }

      const classIds = classes.map((item) => item.id)

      const [enrollmentsResult, gradesResult, submissionsResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('class_id, student_id')
          .eq('school_year', selectedYear)
          .in('class_id', classIds),
        supabase
          .from('grades')
          .select('class_id, student_id, school_year, semester, grading_period')
          .eq('school_year', selectedYear)
          .eq('grading_period', selectedPeriod)
          .in('class_id', classIds),
        supabase
          .from('grade_submissions')
          .select('id, class_id, teacher_id, school_year, term, grading_period, is_submitted, submitted_at')
          .eq('school_year', selectedYear)
          .eq('grading_period', selectedPeriod)
          .in('class_id', classIds),
      ])

      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (gradesResult.error) throw gradesResult.error
      if (submissionsResult.error) throw submissionsResult.error

      const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[]
      const grades = (gradesResult.data ?? []) as GradeRow[]
      const submissions = (submissionsResult.data ?? []) as GradeSubmissionRow[]

      const enrollmentMap = new Map<string, Set<string>>()
      const gradeMap = new Map<string, Set<string>>()
      const submissionMap = new Map<string, GradeSubmissionRow>()

      for (const row of enrollments) {
        if (!enrollmentMap.has(row.class_id)) enrollmentMap.set(row.class_id, new Set())
        enrollmentMap.get(row.class_id)!.add(row.student_id)
      }

      for (const row of grades) {
        const key = `${row.class_id}-${row.semester}`
        if (!gradeMap.has(key)) gradeMap.set(key, new Set())
        gradeMap.get(key)!.add(row.student_id)
      }

      for (const row of submissions) {
        const key = `${row.class_id}-${row.term}`
        submissionMap.set(key, row)
      }

      const nextRows: AdminGradeRow[] = classes
        .map((cls, index) => {
          const classSemesterKey = `${cls.id}-${cls.semester}`
          const totalStudents = (enrollmentMap.get(cls.id) ?? new Set()).size
          const encodedStudents = (gradeMap.get(classSemesterKey) ?? new Set()).size
          const progress = totalStudents > 0 ? Math.round((encodedStudents / totalStudents) * 100) : 0
          const submission = submissionMap.get(classSemesterKey) ?? null

          return {
            rowKey: submission?.id ?? `${cls.id}-${cls.semester}-${selectedPeriod}-${index}`,
            classId: cls.id,
            submissionId: submission?.id ?? null,
            subjectName: cls.subjects?.subject_name ?? 'Unnamed Subject',
            subjectCode: cls.subjects?.subject_code ?? '—',
            gradeLevel: cls.grade_level,
            section: cls.section,
            semester: cls.semester,
            teacherName: getTeacherName(cls.teachers),
            teacherNo: cls.teachers?.teacher_no ?? '—',
            totalStudents,
            encodedStudents,
            progress,
            isSubmitted: submission?.is_submitted ?? false,
            submittedAt: submission?.submitted_at ?? null,
          }
        })
        .sort((a, b) => {
          const teacherCompare = a.teacherName.localeCompare(b.teacherName)
          if (teacherCompare !== 0) return teacherCompare
          const subjectCompare = a.subjectName.localeCompare(b.subjectName)
          if (subjectCompare !== 0) return subjectCompare
          return a.section.localeCompare(b.section)
        })

      setRows(nextRows)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load admin grades.')
      setRows([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const reopenSubmission = async (row: AdminGradeRow) => {
    if (!row.submissionId) {
      toast.error('This class has no submitted record yet.')
      return
    }

    setReopeningId(row.classId)
    try {
      const { error } = await supabase
        .from('grade_submissions')
        .update({
          is_submitted: false,
          submitted_at: null,
          submitted_by: null,
        })
        .eq('id', row.submissionId)

      if (error) throw error

      toast.success('Access restored. Teacher can edit grades again.')
      await loadRows(schoolYear, gradingPeriod)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reopen submission.')
    } finally {
      setReopeningId(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadCurrentPeriod(schoolYear)
    await loadRows(schoolYear, gradingPeriod)
  }

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    if (!schoolYear) return
    loadCurrentPeriod(schoolYear)
  }, [schoolYear])

  useEffect(() => {
    if (!schoolYear) return
    loadRows(schoolYear, gradingPeriod)
  }, [schoolYear, gradingPeriod])

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold text-green-950 sm:text-3xl">Admin Grades</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Fetch grade submission data from the database, display it clearly, and let admin reopen submitted classes so teachers can edit grades again.
            </p>
          </div>

          <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            Current period: {gradingPeriod} · {currentSemester}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Academic Year</label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="">Select academic year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.school_year}>
                  {year.school_year}
                  {year.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Grading Period</label>
            <select
              value={gradingPeriod}
              onChange={(e) => setGradingPeriod(e.target.value as GradingPeriod)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period} Grading Period
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher, subject, code, section"
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-60 xl:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Classes" value={summary.totalClasses} subtitle="Loaded from the database" />
        <SummaryCard title="Submitted" value={summary.submitted} subtitle="Teachers who already submitted" />
        <SummaryCard title="Editable" value={summary.editable} subtitle="Classes still open for editing" />
        <SummaryCard title="Progress" value={`${summary.averageProgress}%`} subtitle="Average encoding progress" />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-green-800" />
          <h2 className="text-xl font-bold text-green-900">Class submissions</h2>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-green-50 p-5 text-gray-500">Loading submissions...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            No records found for this school year and grading period.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((row) => (
              <div key={row.rowKey} className="rounded-2xl border border-green-100 bg-green-50/70 p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-green-950">{row.subjectName}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">{row.subjectCode}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">{row.gradeLevel}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">Section {row.section}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">{row.semester}</span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2 xl:grid-cols-4">
                      <p>Teacher: <span className="font-medium text-gray-900">{row.teacherName}</span></p>
                      <p>Teacher No: <span className="font-medium text-gray-900">{row.teacherNo}</span></p>
                      <p>Students: <span className="font-medium text-gray-900">{row.totalStudents}</span></p>
                      <p>Encoded: <span className="font-medium text-gray-900">{row.encodedStudents}</span></p>
                    </div>

                    <div className="mt-4">
                      <ProgressBar value={row.progress} />
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <p className="font-medium text-gray-800">{row.progress}% complete</p>
                        {row.submittedAt && (
                          <p>
                            Submitted: <span className="font-medium text-gray-900">{new Date(row.submittedAt).toLocaleString()}</span>
                          </p>
                        )}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          row.isSubmitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {row.isSubmitted ? 'Submitted' : 'Not Submitted'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full xl:w-56">
                    {row.isSubmitted ? (
                      <button
                        type="button"
                        onClick={() => reopenSubmission(row)}
                        disabled={reopeningId === row.classId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                      >
                        <LockOpen className="h-4 w-4" />
                        {reopeningId === row.classId ? 'Reopening...' : 'Give Access Again'}
                      </button>
                    ) : (
                      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                        Teacher can still edit because this class is not submitted yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  )
}
