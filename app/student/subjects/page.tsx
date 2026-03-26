'use client'

import { useEffect, useState } from 'react'
import { supabaseStudent } from '@/lib/supabase-student'

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
      description: string | null
    } | null
    teachers: {
      id: string
      first_name: string
      last_name: string
    } | null
  } | null
}

export default function StudentSubjectsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])

  useEffect(() => {
    let mounted = true

    const loadSubjects = async () => {
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
                subject_name,
                description
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

        if (error) throw error
        if (mounted) setEnrollments((data as EnrollmentRow[]) || [])
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load subjects.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSubjects()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="font-medium text-green-900">Loading subjects...</p>
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
        <h1 className="text-2xl font-extrabold md:text-3xl">My Subjects</h1>
        <p className="mt-2 text-sm text-green-100 md:text-base">
          View all your enrolled subjects and assigned teachers.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {enrollments.length === 0 ? (
          <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">No enrolled subjects found.</p>
          </div>
        ) : (
          enrollments.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
            >
              <p className="text-lg font-bold text-green-900">
                {item.classes?.subjects?.subject_name || 'Unknown Subject'}
              </p>
              <p className="mt-1 text-sm font-medium text-yellow-700">
                {item.classes?.subjects?.subject_code || '—'}
              </p>

              <div className="mt-4 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-semibold text-green-900">Teacher:</span>{' '}
                  {item.classes?.teachers
                    ? `${item.classes.teachers.first_name} ${item.classes.teachers.last_name}`
                    : 'TBA'}
                </p>
                <p>
                  <span className="font-semibold text-green-900">Semester:</span>{' '}
                  {item.semester}
                </p>
                <p>
                  <span className="font-semibold text-green-900">School Year:</span>{' '}
                  {item.school_year}
                </p>
                <p>
                  <span className="font-semibold text-green-900">Section:</span>{' '}
                  {item.classes?.section || '—'}
                </p>
                <p>
                  <span className="font-semibold text-green-900">Description:</span>{' '}
                  {item.classes?.subjects?.description || 'No description available.'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}