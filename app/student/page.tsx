'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseStudent } from '@/lib/supabase-student'

type StudentRow = {
  id: string
  profile_id: string | null
  student_no: string
  email: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
}

type EnrollmentRow = {
  id: string
  school_year: string
  semester: string
  class_id: string
  classes: {
    id: string
    section: string
    grade_level: string
    school_year: string
    semester: string
    subjects: {
      id: string
      subject_code: string
      subject_name: string
    } | null
    teachers: {
      id: string
      first_name: string
      last_name: string
    } | null
  } | null
}

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

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [student, setStudent] = useState<StudentRow | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [grades, setGrades] = useState<GradeRow[]>([])

  useEffect(() => {
    let mounted = true

    const loadDashboard = async () => {
      try {
        setLoading(true)
        setError('')

        const {
          data: { user },
        } = await supabaseStudent.auth.getUser()

        if (!user) throw new Error('No authenticated user found.')

        const { data: studentData, error: studentError } = await supabaseStudent
          .from('students')
          .select(
            `
            id,
            profile_id,
            student_no,
            email,
            first_name,
            middle_name,
            last_name,
            suffix,
            grade_level,
            section
          `
          )
          .eq('profile_id', user.id)
          .single()

        if (studentError || !studentData) {
          throw new Error('Student record not found.')
        }

        if (mounted) setStudent(studentData as StudentRow)

        const { data: enrollmentData, error: enrollmentError } =
          await supabaseStudent
            .from('enrollments')
            .select(
              `
              id,
              school_year,
              semester,
              class_id,
              classes (
                id,
                section,
                grade_level,
                school_year,
                semester,
                subjects (
                  id,
                  subject_code,
                  subject_name
                ),
                teachers (
                  id,
                  first_name,
                  last_name
                )
              )
            `
            )
            .eq('student_id', studentData.id)
            .order('enrolled_at', { ascending: false })

        if (enrollmentError) throw enrollmentError
        if (mounted) setEnrollments((enrollmentData as EnrollmentRow[]) || [])

        const { data: gradesData, error: gradesError } = await supabaseStudent
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
          .order('created_at', { ascending: false })

        if (gradesError) throw gradesError
        if (mounted) setGrades((gradesData as GradeRow[]) || [])
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load dashboard.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboard()

    return () => {
      mounted = false
    }
  }, [])

  const averageGrade = useMemo(() => {
    if (!grades.length) return null
    const total = grades.reduce((sum, item) => sum + Number(item.grade), 0)
    return (total / grades.length).toFixed(2)
  }, [grades])

  const latestGrades = grades.slice(0, 5)

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="font-medium text-green-900">Loading dashboard...</p>
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
        <p className="text-sm font-medium text-yellow-300">Welcome back</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
          {student?.first_name} {student?.last_name}
        </h1>
        <p className="mt-2 text-sm text-green-100 md:text-base">
          View your grades, enrolled subjects, and personal information.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="Student No." value={student?.student_no || '—'} />
        <DashboardCard
          label="Grade & Section"
          value={student ? `${student.grade_level} - ${student.section}` : '—'}
        />
        <DashboardCard
          label="Enrolled Subjects"
          value={String(enrollments.length)}
        />
        <DashboardCard
          label="Average Grade"
          value={averageGrade || 'No grades yet'}
          highlight
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-green-900">My Subjects</h2>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              Current Enrollments
            </span>
          </div>

          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">No enrolled subjects found.</p>
          ) : (
            <div className="space-y-3">
              {enrollments.map((enrollment) => {
                const classItem = enrollment.classes
                const subject = classItem?.subjects
                const teacher = classItem?.teachers

                return (
                  <div
                    key={enrollment.id}
                    className="rounded-xl border border-green-100 bg-green-50/50 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-bold text-green-900">
                          {subject?.subject_name || 'Unknown Subject'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {subject?.subject_code || '—'}
                        </p>
                      </div>

                      <div className="text-sm text-gray-700">
                        <p>
                          {teacher
                            ? `${teacher.first_name} ${teacher.last_name}`
                            : 'TBA'}
                        </p>
                        <p>
                          {classItem?.semester} • {classItem?.school_year}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-green-900">Latest Grades</h2>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              Updated
            </span>
          </div>

          {latestGrades.length === 0 ? (
            <p className="text-sm text-gray-500">No grades available yet.</p>
          ) : (
            <div className="space-y-3">
              {latestGrades.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-yellow-100 bg-yellow-50 p-4"
                >
                  <div>
                    <p className="font-semibold text-green-900">
                      {item.classes?.subjects?.subject_name || 'Unknown Subject'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.semester} • {item.grading_period} Grading
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-extrabold text-yellow-700">
                      {item.grade}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.remarks || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DashboardCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p
        className={`mt-2 text-xl font-bold ${
          highlight ? 'text-yellow-600' : 'text-green-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}