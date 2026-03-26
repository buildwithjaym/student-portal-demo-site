'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Layers3,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
} from 'recharts'
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

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
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

type GradingWindowRow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
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
const PIE_COLORS = ['#166534', '#22c55e', '#facc15']

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getPeriodSortValue(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
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

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconWrapClassName,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  iconWrapClassName: string
}) {
  return (
    <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold leading-none text-green-950">{value}</p>
          <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
        </div>

        <div className={`rounded-2xl p-3 ${iconWrapClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default function TeacherPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState<GradingPeriod>('1st')
  const [gradingWindow, setGradingWindow] = useState<GradingWindowRow | null>(null)
  const [availablePeriods, setAvailablePeriods] = useState<GradingPeriod[]>(ALL_PERIODS)
  const [classProgressRows, setClassProgressRows] = useState<ClassProgressRow[]>([])

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const loadGuard = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/login')
      return null
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, is_active, must_change_password')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      toast.error('Failed to load account profile.')
      router.replace('/login')
      return null
    }

    const profileRow = profileData as ProfileRow

    if (!profileRow.is_active) {
      toast.error('Your account is inactive.')
      await supabase.auth.signOut()
      router.replace('/login')
      return null
    }

    if (profileRow.must_change_password) {
      router.replace('/change-password')
      return null
    }

    if (profileRow.role !== 'teacher') {
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

    const teacherRow = teacherData as TeacherRow

    if (!teacherRow.is_active) {
      toast.error('Your teacher account is inactive.')
      router.replace('/login')
      return null
    }

    setTeacher(teacherRow)
    return teacherRow
  }

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message)
      setAcademicYears([])
      return []
    }

    const rows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(rows)

    if (rows.length > 0) {
      const active = rows.find((row) => row.is_active)
      setSelectedSchoolYear((prev) => prev || active?.school_year || rows[0].school_year)
    }

    return rows
  }

  const loadWindowsAndSetCurrentPeriod = async (schoolYear: string) => {
    if (!schoolYear) {
      setGradingWindow(null)
      setAvailablePeriods(ALL_PERIODS)
      return
    }

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', schoolYear)

    if (error) {
      toast.error(error.message)
      setGradingWindow(null)
      setAvailablePeriods(ALL_PERIODS)
      return
    }

    const rows = (data ?? []) as GradingWindowRow[]

    const uniquePeriods = Array.from(
      new Set(rows.map((row) => row.grading_period as GradingPeriod))
    ).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b))

    setAvailablePeriods(uniquePeriods.length > 0 ? uniquePeriods : ALL_PERIODS)

    const openWindow =
      rows
        .filter((row) => row.is_open && !row.is_locked)
        .sort(
          (a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
        )[0] ?? null

    const fallbackWindow =
      rows.sort(
        (a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
      )[0] ?? null

    const chosenWindow = openWindow ?? fallbackWindow

    if (chosenWindow) {
      setSelectedGradingPeriod(chosenWindow.grading_period)
      setGradingWindow(chosenWindow)
    } else {
      setSelectedGradingPeriod('1st')
      setGradingWindow(null)
    }
  }

  const loadSpecificWindow = async (schoolYear: string, gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      setGradingWindow(null)
      return
    }

    const semester = getSemesterFromPeriod(gradingPeriod)

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .eq('grading_period', gradingPeriod)
      .maybeSingle()

    if (error) {
      toast.error(error.message)
      setGradingWindow(null)
      return
    }

    setGradingWindow((data as GradingWindowRow | null) ?? null)
  }

  const loadTeacherData = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear) {
      setClassProgressRows([])
      return
    }

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
      return
    }

    const classRows = (classesData ?? []) as ClassRow[]

    if (classRows.length === 0) {
      setClassProgressRows([])
      return
    }

    const classIds = classRows.map((item) => item.id)

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

    if (enrollmentsResult.error) {
      toast.error(enrollmentsResult.error.message)
      setClassProgressRows([])
      return
    }

    if (gradesResult.error) {
      toast.error(gradesResult.error.message)
      setClassProgressRows([])
      return
    }

    if (submissionsResult.error) {
      toast.error(submissionsResult.error.message)
      setClassProgressRows([])
      return
    }

    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[]
    const grades = (gradesResult.data ?? []) as GradeRow[]
    const submissions = (submissionsResult.data ?? []) as GradeSubmissionRow[]

    const enrollmentMap = new Map<string, Set<string>>()
    const gradeMap = new Map<string, Set<string>>()
    const submissionMap = new Map<string, boolean>()

    for (const row of enrollments) {
      if (!enrollmentMap.has(row.class_id)) enrollmentMap.set(row.class_id, new Set())
      enrollmentMap.get(row.class_id)!.add(row.student_id)
    }

    for (const row of grades) {
      if (!gradeMap.has(row.class_id)) gradeMap.set(row.class_id, new Set())
      gradeMap.get(row.class_id)!.add(row.student_id)
    }

    for (const row of submissions) {
      submissionMap.set(row.class_id, row.is_submitted)
    }

    const progressRows: ClassProgressRow[] = classRows.map((cls) => {
      const enrolledStudents = enrollmentMap.get(cls.id) ?? new Set<string>()
      const encodedStudents = gradeMap.get(cls.id) ?? new Set<string>()

      const totalStudents = enrolledStudents.size
      const encodedGrades = encodedStudents.size
      const progress =
        totalStudents > 0 ? Math.round((encodedGrades / totalStudents) * 100) : 0

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
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const teacherRow = await loadGuard()
      if (!teacherRow) return

      const years = await loadAcademicYears()
      const activeYear = years.find((row) => row.is_active)?.school_year || years[0]?.school_year

      if (activeYear) {
        await loadWindowsAndSetCurrentPeriod(activeYear)
      }

      setLoading(false)
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSchoolYear) return
    loadWindowsAndSetCurrentPeriod(selectedSchoolYear)
  }, [selectedSchoolYear])

  useEffect(() => {
    if (!selectedSchoolYear) return
    loadSpecificWindow(selectedSchoolYear, selectedGradingPeriod)
  }, [selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear) return
    loadTeacherData(teacher.id, selectedSchoolYear, selectedGradingPeriod)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod])

  const canEncodeGrades = gradingWindow?.is_open === true && gradingWindow?.is_locked === false

  const summary = useMemo(() => {
    const assignedClasses = classProgressRows.length
    const totalStudents = classProgressRows.reduce((sum, row) => sum + row.totalStudents, 0)
    const submittedClasses = classProgressRows.filter((row) => row.isSubmitted).length
    const pendingClasses = Math.max(0, assignedClasses - submittedClasses)
    const averageProgress =
      assignedClasses > 0
        ? Math.round(
            classProgressRows.reduce((sum, row) => sum + row.progress, 0) / assignedClasses
          )
        : 0

    return {
      assignedClasses,
      totalStudents,
      submittedClasses,
      pendingClasses,
      averageProgress,
    }
  }, [classProgressRows])

  const chartData = useMemo(
    () =>
      classProgressRows.map((row) => ({
        name: `${row.subjectCode} • ${row.section}`,
        progress: row.progress,
        encoded: row.encodedGrades,
        students: row.totalStudents,
      })),
    [classProgressRows]
  )

  const submissionData = useMemo(
    () => [
      { name: 'Submitted', value: summary.submittedClasses },
      { name: 'Pending', value: summary.pendingClasses },
      {
        name: 'No Progress',
        value: classProgressRows.filter((row) => row.progress === 0 && !row.isSubmitted).length,
      },
    ].filter((item, index, arr) => item.value > 0 || (index === 0 && arr.every((x) => x.value === 0))),
    [classProgressRows, summary.pendingClasses, summary.submittedClasses]
  )

  const topNeedsAttention = useMemo(
    () => [...classProgressRows].sort((a, b) => a.progress - b.progress).slice(0, 3),
    [classProgressRows]
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-gray-500">Loading teacher dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[28px] bg-gradient-to-r from-green-950 via-green-900 to-green-800 p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-green-50 ring-1 ring-white/10">
              <BarChart3 className="h-3.5 w-3.5" />
              Teacher Dashboard
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {teacher ? formatFullName(teacher) : 'Teacher'}
            </h1>

            <p className="mt-3 text-sm leading-6 text-green-50/90 sm:text-base">
              Monitor class progress, track submissions, and jump straight into grade encoding for the active grading window.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                Teacher No: {teacher?.teacher_no ?? '—'}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                {selectedSchoolYear || 'No Academic Year'}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                {selectedGradingPeriod} Grading Period
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                {selectedSemester}
              </span>
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10 xl:w-[300px]">
            <p className="text-sm font-medium text-green-100">Encoding Access</p>
            <p className="mt-2 text-2xl font-bold">
              {canEncodeGrades ? 'Available' : 'Unavailable'}
            </p>
            <p className="mt-2 text-sm text-green-50/85">
              {canEncodeGrades
                ? 'The grading window is open and ready for updates.'
                : 'Grade encoding is closed or locked for this period.'}
            </p>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Assigned Classes"
          value={summary.assignedClasses}
          subtitle="Total active classes this term"
          icon={BookOpen}
          iconWrapClassName="bg-green-100 text-green-800"
        />
        <SummaryCard
          title="Total Students"
          value={summary.totalStudents}
          subtitle="Combined enrolled learners"
          icon={Users}
          iconWrapClassName="bg-blue-100 text-blue-800"
        />
        <SummaryCard
          title="Submitted Classes"
          value={summary.submittedClasses}
          subtitle={`${summary.pendingClasses} class(es) still pending`}
          icon={CheckCircle2}
          iconWrapClassName="bg-emerald-100 text-emerald-800"
        />
        <SummaryCard
          title="Average Progress"
          value={`${summary.averageProgress}%`}
          subtitle="Average encoding completion"
          icon={TrendingUp}
          iconWrapClassName="bg-purple-100 text-purple-800"
        />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Academic Year</label>
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
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
              value={selectedGradingPeriod}
              onChange={(e) => setSelectedGradingPeriod(e.target.value as GradingPeriod)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {availablePeriods.map((period) => (
                <option key={period} value={period}>
                  {period} Grading Period
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-green-50 p-4">
            <p className="text-sm font-medium text-gray-600">Window Status</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  gradingWindow?.is_open ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {gradingWindow?.is_open ? 'Open' : 'Closed'}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  gradingWindow?.is_locked ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {gradingWindow?.is_locked ? 'Locked' : 'Unlocked'}
              </span>
            </div>
          </div>
        </div>

        {!gradingWindow && (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            No grading window is configured for this school year and grading period.
          </div>
        )}

        {gradingWindow && !canEncodeGrades && (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            Grade encoding is currently unavailable. You can only encode grades when the selected grading period is open and not locked.
          </div>
        )}
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-stretch">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-green-950">Class Progress Overview</h2>
              <p className="text-sm text-gray-600">Encoding completion by class.</p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No chart data available for the selected filters.
            </div>
          ) : (
            <div className="h-[320px] min-h-[320px] w-full min-w-0 overflow-hidden rounded-2xl">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-18}
                    textAnchor="end"
                    height={60}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="progress" radius={[10, 10, 0, 0]} fill="#166534" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4">
            <h2 className="text-xl font-bold text-green-950">Submission Snapshot</h2>
            <p className="text-sm text-gray-600">Basic breakdown of class submission status.</p>
          </div>

          {classProgressRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No submission data available.
            </div>
          ) : (
            <>
              <div className="h-[250px] min-h-[250px] w-full min-w-0 overflow-hidden rounded-2xl">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={submissionData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                    >
                      {submissionData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-2">
                {submissionData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-green-950">My Classes</h2>
              <p className="text-sm text-gray-600">Review progress and open grade encoding quickly.</p>
            </div>
          </div>

          {classProgressRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No assigned classes found for the selected academic year and grading period.
            </div>
          ) : (
            <div className="space-y-4">
              {classProgressRows.map((row) => (
                <div key={row.classId} className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-green-950">{row.subjectName}</h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          {row.subjectCode}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          {row.gradeLevel}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                          Section {row.section}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-3">
                        <p>
                          Students: <span className="font-medium text-gray-900">{row.totalStudents}</span>
                        </p>
                        <p>
                          Encoded: <span className="font-medium text-gray-900">{row.encodedGrades}</span>
                        </p>
                        <p>
                          Status:{' '}
                          <span className="font-medium text-gray-900">
                            {row.isSubmitted ? 'Submitted' : 'Pending'}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4">
                        <ProgressBar value={row.progress} />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">{row.progress}% complete</p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.isSubmitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {row.isSubmitted ? 'Submitted' : 'Pending Submission'}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:w-48 xl:grid-cols-1">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/teacher/grades?classId=${row.classId}&schoolYear=${encodeURIComponent(
                              selectedSchoolYear
                            )}&semester=${encodeURIComponent(
                              selectedSemester
                            )}&gradingPeriod=${encodeURIComponent(selectedGradingPeriod)}`
                          )
                        }
                        disabled={!canEncodeGrades}
                        className="rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {canEncodeGrades ? 'Open Grade Encoding' : 'Grading Not Available'}
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
                        className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        Open Reports
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-green-950">Needs Attention</h2>
              <p className="text-sm text-gray-600">Classes with the lowest progress first.</p>
            </div>

            {topNeedsAttention.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                Nothing to show yet.
              </div>
            ) : (
              <div className="space-y-3">
                {topNeedsAttention.map((row) => (
                  <div key={row.classId} className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{row.subjectCode} • {row.section}</p>
                        <p className="text-sm text-gray-500">{row.subjectName}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                        {row.progress}%
                      </span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={row.progress} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-green-950">Quick Actions</h2>
              <p className="text-sm text-gray-600">Only the main actions teachers need most.</p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => router.push('/teacher/grades')}
                className="flex w-full items-start gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-left transition hover:bg-green-100"
              >
                <div className="rounded-xl bg-white p-2 text-green-800">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Grade Encoding</p>
                  <p className="text-sm text-gray-600">Encode and review student grades</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/teacher/reports')}
                className="flex w-full items-start gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-left transition hover:bg-green-100"
              >
                <div className="rounded-xl bg-white p-2 text-green-800">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Reports</p>
                  <p className="text-sm text-gray-600">Open class reports and summaries</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/teacher/classes')}
                className="flex w-full items-start gap-3 rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-left transition hover:bg-green-100"
              >
                <div className="rounded-xl bg-white p-2 text-green-800">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">My Classes</p>
                  <p className="text-sm text-gray-600">See your assigned classes</p>
                </div>
              </button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-green-100 p-3 text-green-800">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-green-950">Teacher Note</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  This version removes the extra rules panel and duplicate top stats, then replaces them with simple visual summaries so teachers can understand progress faster.
                </p>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}
