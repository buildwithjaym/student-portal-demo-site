'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'

type ProfileRow = {
  id: string
  role: 'admin' | 'teacher' | 'student'
  is_active: boolean
  must_change_password: boolean
}

type TeacherRow = {
  id: string
  profile_id: string | null
  teacher_no: string
  email: string | null
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  is_active: boolean
}

type AcademicYearRow = {
  id: string
  school_year: string
  is_active: boolean
}

type GradingWindowRow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
}

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
}

type ClassRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  grade_level: string
  section: string
  school_year: string
  semester: Semester
  is_active: boolean
  subjects: SubjectRow | null
}

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type GradeRow = {
  class_id: string
  student_id: string
}

type GradeSubmissionRow = {
  class_id: string
  is_submitted: boolean
}

type ClassProgressRow = {
  classId: string
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  totalStudents: number
  encodedGrades: number
  progress: number
  isSubmitted: boolean
}

const ALL_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getPeriodSortValue(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

export default function TeacherPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState<GradingPeriod>('1st')
  const [gradingWindows, setGradingWindows] = useState<GradingWindowRow[]>([])
  const [availablePeriods, setAvailablePeriods] = useState<GradingPeriod[]>(ALL_PERIODS)
  const [classProgressRows, setClassProgressRows] = useState<ClassProgressRow[]>([])

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const gradingWindow = useMemo(() => {
    return (
      gradingWindows.find(
        (row) =>
          row.school_year === selectedSchoolYear &&
          row.semester === selectedSemester &&
          row.grading_period === selectedGradingPeriod
      ) ?? null
    )
  }, [gradingWindows, selectedSchoolYear, selectedSemester, selectedGradingPeriod])

  const canEncodeGrades =
    gradingWindow?.is_open === true && gradingWindow?.is_locked === false

  const loadTeacher = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return null
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, is_active, must_change_password')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      toast.error('Failed to load account profile.')
      router.replace('/login')
      return null
    }

    if (!profile.is_active) {
      toast.error('Your account is inactive.')
      await supabase.auth.signOut()
      router.replace('/login')
      return null
    }

    if (profile.must_change_password) {
      router.replace('/change-password')
      return null
    }

    if (profile.role !== 'teacher') {
      router.replace('/login')
      return null
    }

    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select(
        'id, profile_id, teacher_no, email, first_name, middle_name, last_name, suffix, is_active'
      )
      .eq('profile_id', user.id)
      .maybeSingle()

    if (teacherError || !teacherData) {
      toast.error('Teacher record not found.')
      router.replace('/login')
      return null
    }

    if (!teacherData.is_active) {
      toast.error('Your teacher account is inactive.')
      router.replace('/login')
      return null
    }

    setTeacher(teacherData as TeacherRow)
    return teacherData as TeacherRow
  }

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message)
      setAcademicYears([])
      return
    }

    const rows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(rows)

    const activeYear = rows.find((row) => row.is_active)?.school_year ?? rows[0]?.school_year ?? ''
    setSelectedSchoolYear(activeYear)
  }

  const loadWindows = async (schoolYear: string) => {
    if (!schoolYear) {
      setGradingWindows([])
      setAvailablePeriods(ALL_PERIODS)
      return
    }

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', schoolYear)

    if (error) {
      toast.error(error.message)
      setGradingWindows([])
      setAvailablePeriods(ALL_PERIODS)
      return
    }

    const rows = (data ?? []) as GradingWindowRow[]
    setGradingWindows(rows)

    const periods = Array.from(
      new Set(rows.map((row) => row.grading_period as GradingPeriod))
    ).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b))

    setAvailablePeriods(periods.length > 0 ? periods : ALL_PERIODS)

    const openWindow =
      rows
        .filter((row) => row.is_open && !row.is_locked)
        .sort((a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period))[0] ??
      null

    const fallbackWindow =
      [...rows].sort((a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period))[0] ??
      null

    const chosen = openWindow ?? fallbackWindow
    setSelectedGradingPeriod(chosen?.grading_period ?? '1st')
  }

  const loadTeacherDashboardData = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    if (!teacherId || !schoolYear) {
      setClassProgressRows([])
      return
    }

    setDataLoading(true)

    const semester = getSemesterFromPeriod(gradingPeriod)

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
        )
      `)
      .eq('teacher_id', teacherId)
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .eq('is_active', true)
      .order('section', { ascending: true })

    if (classesError) {
      toast.error(classesError.message)
      setClassProgressRows([])
      setDataLoading(false)
      return
    }

    const classRows = (classesData ?? []) as ClassRow[]

    if (classRows.length === 0) {
      setClassProgressRows([])
      setDataLoading(false)
      return
    }

    const classIds = classRows.map((row) => row.id)

    const [enrollmentsResult, gradesResult, submissionsResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select('class_id, student_id')
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .in('class_id', classIds),
      supabase
        .from('grades')
        .select('class_id, student_id')
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .eq('grading_period', gradingPeriod)
        .in('class_id', classIds),
      supabase
        .from('grade_submissions')
        .select('class_id, is_submitted')
        .eq('school_year', schoolYear)
        .eq('term', semester)
        .eq('grading_period', gradingPeriod)
        .in('class_id', classIds),
    ])

    if (enrollmentsResult.error || gradesResult.error || submissionsResult.error) {
      toast.error(
        enrollmentsResult.error?.message ||
          gradesResult.error?.message ||
          submissionsResult.error?.message ||
          'Failed to load class progress.'
      )
      setClassProgressRows([])
      setDataLoading(false)
      return
    }

    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[]
    const grades = (gradesResult.data ?? []) as GradeRow[]
    const submissions = (submissionsResult.data ?? []) as GradeSubmissionRow[]

    const enrollmentMap = new Map<string, Set<string>>()
    const gradeMap = new Map<string, Set<string>>()
    const submissionMap = new Map<string, boolean>()

    for (const row of enrollments) {
      if (!enrollmentMap.has(row.class_id)) {
        enrollmentMap.set(row.class_id, new Set<string>())
      }
      enrollmentMap.get(row.class_id)!.add(row.student_id)
    }

    for (const row of grades) {
      if (!gradeMap.has(row.class_id)) {
        gradeMap.set(row.class_id, new Set<string>())
      }
      gradeMap.get(row.class_id)!.add(row.student_id)
    }

    for (const row of submissions) {
      submissionMap.set(row.class_id, row.is_submitted)
    }

    const progressRows: ClassProgressRow[] = classRows.map((cls) => {
      const enrolled = enrollmentMap.get(cls.id) ?? new Set<string>()
      const encoded = gradeMap.get(cls.id) ?? new Set<string>()

      const totalStudents = enrolled.size
      const encodedGrades = encoded.size
      const progress = totalStudents > 0 ? Math.round((encodedGrades / totalStudents) * 100) : 0

      return {
        classId: cls.id,
        subjectName: cls.subjects?.subject_name ?? 'Unnamed Subject',
        subjectCode: cls.subjects?.subject_code ?? '—',
        gradeLevel: cls.grade_level,
        section: cls.section,
        totalStudents,
        encodedGrades,
        progress,
        isSubmitted: submissionMap.get(cls.id) ?? false,
      }
    })

    setClassProgressRows(progressRows)
    setDataLoading(false)
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const teacherRow = await loadTeacher()
      if (!teacherRow) return
      await loadAcademicYears()
      setLoading(false)
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSchoolYear) return
    loadWindows(selectedSchoolYear)
  }, [selectedSchoolYear])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear) return
    loadTeacherDashboardData(teacher.id, selectedSchoolYear, selectedGradingPeriod)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod])

  const summary = useMemo(() => {
    const assignedClasses = classProgressRows.length
    const totalStudents = classProgressRows.reduce((sum, row) => sum + row.totalStudents, 0)
    const submittedClasses = classProgressRows.filter((row) => row.isSubmitted).length
    const averageProgress =
      assignedClasses > 0
        ? Math.round(classProgressRows.reduce((sum, row) => sum + row.progress, 0) / assignedClasses)
        : 0

    return {
      assignedClasses,
      totalStudents,
      submittedClasses,
      averageProgress,
    }
  }, [classProgressRows])

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-green-950">
          Welcome back, {teacher ? formatFullName(teacher) : 'Teacher'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {selectedSchoolYear || 'No school year'} • {selectedGradingPeriod} Grading Period • {selectedSemester}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Assigned Classes</p>
          <p className="mt-2 text-2xl font-bold text-green-950">{summary.assignedClasses}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="mt-2 text-2xl font-bold text-green-950">{summary.totalStudents}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Submitted Classes</p>
          <p className="mt-2 text-2xl font-bold text-green-950">{summary.submittedClasses}</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Average Progress</p>
          <p className="mt-2 text-2xl font-bold text-green-950">{summary.averageProgress}%</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <select
            value={selectedSchoolYear}
            onChange={(e) => setSelectedSchoolYear(e.target.value)}
            className="rounded-2xl border border-gray-300 px-4 py-3"
          >
            <option value="">Select academic year</option>
            {academicYears.map((row) => (
              <option key={row.id} value={row.school_year}>
                {row.school_year}
              </option>
            ))}
          </select>

          <select
            value={selectedGradingPeriod}
            onChange={(e) => setSelectedGradingPeriod(e.target.value as GradingPeriod)}
            className="rounded-2xl border border-gray-300 px-4 py-3"
          >
            {availablePeriods.map((period) => (
              <option key={period} value={period}>
                {period} Grading Period
              </option>
            ))}
          </select>

          <div className="rounded-2xl bg-green-50 p-4 text-sm">
            <div>Window: {gradingWindow?.is_open ? 'Open' : 'Closed'}</div>
            <div>Lock: {gradingWindow?.is_locked ? 'Locked' : 'Unlocked'}</div>
            <div className="mt-1 font-semibold text-green-900">
              Encoding: {canEncodeGrades ? 'Available' : 'Unavailable'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-green-950">My Classes</h2>

        {dataLoading ? (
          <div className="mt-4 text-sm text-gray-500">Loading class progress...</div>
        ) : classProgressRows.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">
            No classes found for the selected filters.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {classProgressRows.map((row) => (
              <div
                key={row.classId}
                className="rounded-2xl border border-green-100 bg-green-50/60 p-4"
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h3 className="font-bold text-green-950">
                      {row.subjectName} ({row.subjectCode})
                    </h3>
                    <p className="text-sm text-gray-600">
                      {row.gradeLevel} • Section {row.section}
                    </p>
                    <p className="mt-1 text-sm text-gray-700">
                      {row.encodedGrades}/{row.totalStudents} encoded • {row.progress}% •{' '}
                      {row.isSubmitted ? 'Submitted' : 'Pending'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canEncodeGrades}
                      onClick={() =>
                        router.push(
                          `/teacher/grades?classId=${row.classId}&schoolYear=${encodeURIComponent(
                            selectedSchoolYear
                          )}&semester=${encodeURIComponent(
                            selectedSemester
                          )}&gradingPeriod=${encodeURIComponent(selectedGradingPeriod)}`
                        )
                      }
                      className="rounded-xl bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Open Grade Encoding
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/teacher/reports?classId=${row.classId}&schoolYear=${encodeURIComponent(
                            selectedSchoolYear
                          )}&semester=${encodeURIComponent(selectedSemester)}`
                        )
                      }
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
                    >
                      Open Reports
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}