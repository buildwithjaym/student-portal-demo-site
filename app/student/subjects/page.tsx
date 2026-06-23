'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, RefreshCw, UserRound } from 'lucide-react'
import { supabaseStudent } from '@/lib/supabase-student'

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
  description: string | null
}

type TeacherRow = {
  id: string
  first_name: string
  last_name: string
}

type ClassRelation = {
  id: string
  section: string | null
  grade_level: string | null
  school_year: string
  semester: string
  subjects: SubjectRow | null
  teachers: TeacherRow | null
}

type EnrollmentRow = {
  id: string
  school_year: string
  semester: string
  class_id: string
  classes: ClassRelation | null
}

type RawClassRelation = {
  id: string
  section: string | null
  grade_level: string | null
  school_year: string
  semester: string
  subjects: SubjectRow[] | SubjectRow | null
  teachers: TeacherRow[] | TeacherRow | null
}

type RawEnrollmentRow = {
  id: string
  school_year: string
  semester: string
  class_id: string
  classes: RawClassRelation[] | RawClassRelation | null
}

function getSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeClassRelation(
  value: RawClassRelation[] | RawClassRelation | null | undefined
): ClassRelation | null {
  const raw = getSingleRelation(value)
  if (!raw) return null

  return {
    id: raw.id,
    section: raw.section ?? null,
    grade_level: raw.grade_level ?? null,
    school_year: raw.school_year,
    semester: raw.semester,
    subjects: getSingleRelation(raw.subjects),
    teachers: getSingleRelation(raw.teachers),
  }
}

function normalizeEnrollmentRow(row: RawEnrollmentRow): EnrollmentRow {
  return {
    id: row.id,
    school_year: row.school_year,
    semester: row.semester,
    class_id: row.class_id,
    classes: normalizeClassRelation(row.classes),
  }
}

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'TBA'
  return `${teacher.first_name} ${teacher.last_name}`.trim()
}

export default function StudentSubjectsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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

        const normalized = ((data ?? []) as RawEnrollmentRow[]).map(
          normalizeEnrollmentRow
        )

        if (!mounted) return
        setEnrollments(normalized)
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load subjects.')
          setEnrollments([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadSubjects()

    return () => {
      mounted = false
    }
  }, [])

  const subjectCards = useMemo(() => {
    return enrollments
      .slice()
      .sort((a, b) => {
        const schoolYearCompare = b.school_year.localeCompare(a.school_year)
        if (schoolYearCompare !== 0) return schoolYearCompare

        const semesterCompare = a.semester.localeCompare(b.semester)
        if (semesterCompare !== 0) return semesterCompare

        const nameA = a.classes?.subjects?.subject_name ?? ''
        const nameB = b.classes?.subjects?.subject_name ?? ''
        return nameA.localeCompare(nameB)
      })
  }, [enrollments])

  const handleRefresh = () => {
    setRefreshing(true)
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="font-medium text-cyan-900">Loading subjects...</p>
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
      <section className="rounded-3xl bg-gradient-to-r from-cyan-950 via-cyan-900 to-cyan-800 px-6 py-7 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">My Subjects</h1>
            <p className="mt-2 text-sm text-cyan-100 md:text-base">
              View all your enrolled subjects and assigned teachers.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {subjectCards.length === 0 ? (
        <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">No enrolled subjects found.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {subjectCards.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-cyan-900">
                    {item.classes?.subjects?.subject_name || 'Unknown Subject'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-cyan-700">
                    {item.classes?.subjects?.subject_code || '—'}
                  </p>
                </div>

                <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p className="flex items-start gap-2">
                  <UserRound className="mt-0.5 h-4 w-4 text-cyan-700" />
                  <span>
                    <span className="font-semibold text-cyan-900">Teacher:</span>{' '}
                    {getTeacherName(item.classes?.teachers ?? null)}
                  </span>
                </p>

                <p>
                  <span className="font-semibold text-cyan-900">Semester:</span>{' '}
                  {item.semester}
                </p>

                <p>
                  <span className="font-semibold text-cyan-900">School Year:</span>{' '}
                  {item.school_year}
                </p>

                <p>
                  <span className="font-semibold text-cyan-900">Grade Level:</span>{' '}
                  {item.classes?.grade_level || '—'}
                </p>

                <p>
                  <span className="font-semibold text-cyan-900">Section:</span>{' '}
                  {item.classes?.section || '—'}
                </p>

                <p>
                  <span className="font-semibold text-cyan-900">Description:</span>{' '}
                  {item.classes?.subjects?.description || 'No description available.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
