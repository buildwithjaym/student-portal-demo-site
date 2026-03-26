'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseStudent } from '@/lib/supabase-student'

type GradeRow = {
  id: string
  grading_period: string
  semester: string
  school_year: string
  grade: number
  remarks: string | null
  classes: {
    id: string
    subjects: {
      id: string
      subject_code: string
      subject_name: string
    } | null
  } | null
}

type GroupedSubject = {
  subjectId: string
  subjectName: string
  subjectCode: string
  schoolYear: string
  semester: string
  periods: Record<string, GradeRow>
  average: number
}

const PERIOD_ORDER = ['1st', '2nd', '3rd', '4th', 'First', 'Second', 'Third', 'Fourth']

function normalizePeriod(period: string) {
  const value = period.toLowerCase()

  if (value.includes('1')) return '1st Period'
  if (value.includes('2')) return '2nd Period'
  if (value.includes('3')) return '3rd Period'
  if (value.includes('4')) return '4th Period'

  if (value.includes('first')) return '1st Period'
  if (value.includes('second')) return '2nd Period'
  if (value.includes('third')) return '3rd Period'
  if (value.includes('fourth')) return '4th Period'

  return period
}

function getAcademicRemark(grade: number) {
  if (grade >= 98) {
    return {
      label: 'With Highest Honors',
      status: 'passed',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    }
  }

  if (grade >= 95) {
    return {
      label: 'With High Honors',
      status: 'passed',
      badge: 'bg-green-100 text-green-700 border-green-200',
    }
  }

  if (grade >= 90) {
    return {
      label: 'With Honors',
      status: 'passed',
      badge: 'bg-lime-100 text-lime-700 border-lime-200',
    }
  }

  if (grade >= 85) {
    return {
      label: 'Passed',
      status: 'passed',
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
    }
  }

  if (grade >= 80) {
    return {
      label: 'Fairly Satisfactory',
      status: 'passed',
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
    }
  }

  if (grade >= 75) {
    return {
      label: 'Did Not Meet Expectations',
      status: 'conditional',
      badge: 'bg-orange-100 text-orange-700 border-orange-200',
    }
  }

  return {
    label: 'Failed',
    status: 'failed',
    badge: 'bg-red-100 text-red-700 border-red-200',
  }
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export default function StudentGradesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [grades, setGrades] = useState<GradeRow[]>([])
  const [semesterFilter, setSemesterFilter] = useState('All')

  useEffect(() => {
    let mounted = true

    const loadGrades = async () => {
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

        const { data, error } = await supabaseStudent
          .from('grades')
          .select(
            `
            id,
            grading_period,
            semester,
            school_year,
            grade,
            remarks,
            classes (
              id,
              subjects (
                id,
                subject_code,
                subject_name
              )
            )
          `
          )
          .eq('student_id', studentData.id)
          .order('school_year', { ascending: false })
          .order('semester', { ascending: true })
          .order('grading_period', { ascending: true })

        if (error) throw error
        if (mounted) setGrades((data as GradeRow[]) || [])
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load grades.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadGrades()

    return () => {
      mounted = false
    }
  }, [])

  const filteredGrades = useMemo(() => {
    if (semesterFilter === 'All') return grades
    return grades.filter((item) => item.semester === semesterFilter)
  }, [grades, semesterFilter])

  const groupedSubjects = useMemo(() => {
    const map = new Map<string, GroupedSubject>()

    for (const item of filteredGrades) {
      const subjectId = item.classes?.subjects?.id || item.classes?.id || item.id
      const subjectName = item.classes?.subjects?.subject_name || 'Unknown Subject'
      const subjectCode = item.classes?.subjects?.subject_code || '—'
      const periodKey = normalizePeriod(item.grading_period)
      const key = `${item.school_year}__${item.semester}__${subjectId}`

      if (!map.has(key)) {
        map.set(key, {
          subjectId,
          subjectName,
          subjectCode,
          schoolYear: item.school_year,
          semester: item.semester,
          periods: {},
          average: 0,
        })
      }

      map.get(key)!.periods[periodKey] = item
    }

    const results = Array.from(map.values()).map((subject) => {
      const values = Object.values(subject.periods).map((entry) => entry.grade)
      const average =
        values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : 0

      return {
        ...subject,
        average,
      }
    })

    return results.sort((a, b) => {
      if (a.schoolYear !== b.schoolYear) return b.schoolYear.localeCompare(a.schoolYear)
      if (a.semester !== b.semester) return a.semester.localeCompare(b.semester)
      return a.subjectName.localeCompare(b.subjectName)
    })
  }, [filteredGrades])

  const summary = useMemo(() => {
    const averages = groupedSubjects.map((item) => item.average)
    const overallAverage =
      averages.length > 0
        ? averages.reduce((sum, value) => sum + value, 0) / averages.length
        : 0

    const passedCount = groupedSubjects.filter((item) => item.average >= 75).length
    const failedCount = groupedSubjects.filter((item) => item.average < 75).length

    return {
      overallAverage,
      passedCount,
      failedCount,
      totalSubjects: groupedSubjects.length,
    }
  }, [groupedSubjects])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="font-medium text-green-900">Loading grades...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Error</p>
        <p className="mt-2 text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-extrabold md:text-3xl">My Grades</h1>
        <p className="mt-2 text-sm text-green-100 md:text-base">
          View your grades per subject, grading period, and semester.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Overall Average</p>
          <p className="mt-2 text-3xl font-extrabold text-green-900">
            {summary.totalSubjects ? formatNumber(summary.overallAverage) : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Subjects</p>
          <p className="mt-2 text-3xl font-extrabold text-green-900">
            {summary.totalSubjects}
          </p>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Passed</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-700">
            {summary.passedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Failed</p>
          <p className="mt-2 text-3xl font-extrabold text-red-700">
            {summary.failedCount}
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold text-green-900">Grade Records</h2>

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="rounded-xl border border-green-200 bg-white px-4 py-3 text-sm font-medium text-green-900 outline-none focus:border-green-500"
          >
            <option value="All">All Semesters</option>
            <option value="1st Semester">1st Semester</option>
            <option value="2nd Semester">2nd Semester</option>
          </select>
        </div>

        {groupedSubjects.length === 0 ? (
          <p className="text-sm text-gray-500">No grades found.</p>
        ) : (
          <div className="space-y-4">
            {groupedSubjects.map((subject) => {
              const averageInfo = getAcademicRemark(subject.average)

              return (
                <div
                  key={`${subject.schoolYear}-${subject.semester}-${subject.subjectId}`}
                  className="rounded-2xl border border-green-100 bg-gradient-to-br from-white to-green-50 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-extrabold text-green-900">
                        {subject.subjectName}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-gray-600">
                        {subject.subjectCode}
                      </p>
                      <p className="mt-2 text-sm text-gray-500">
                        {subject.schoolYear} • {subject.semester}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <div className="text-3xl font-extrabold text-yellow-700">
                        {formatNumber(subject.average)}
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${averageInfo.badge}`}
                      >
                        {averageInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {['1st Period', '2nd Period', '3rd Period', '4th Period'].map((label) => {
                      const entry = subject.periods[label]
                      const info = entry ? getAcademicRemark(entry.grade) : null

                      return (
                        <div
                          key={label}
                          className="rounded-xl border border-green-100 bg-white p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {label}
                          </p>

                          <p className="mt-3 text-2xl font-extrabold text-green-900">
                            {entry ? entry.grade : '—'}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {info ? info.label : 'No grade yet'}
                          </p>

                          {entry?.remarks ? (
                            <p className="mt-2 text-xs text-gray-500">
                              Teacher remark: {entry.remarks}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}