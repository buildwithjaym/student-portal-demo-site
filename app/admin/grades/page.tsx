'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  LockOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'

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
  opened_by: string | null
  locked_by: string | null
  opened_at: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
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

type GradeSubmissionRow = {
  id: string
  class_id: string
  teacher_id: string
  school_year: string
  term: Semester
  grading_period: GradingPeriod
  is_submitted: boolean
  submitted_by: string | null
  submitted_at: string | null
}

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type GradeRow = {
  class_id: string
  student_id: string
  semester: Semester
  grading_period: GradingPeriod
}

type AdminSubmissionRow = {
  key: string
  submissionId: string
  classId: string
  teacherId: string
  teacherName: string
  teacherNo: string
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  schoolYear: string
  semester: Semester
  gradingPeriod: GradingPeriod
  totalStudents: number
  encodedStudents: number
  progress: number
  isSubmitted: boolean
  submittedAt: string | null
}

type DebugInfo = {
  selectedYear: string
  selectedPeriod: GradingPeriod
  selectedSemester: Semester
  submissions: number
  classes: number
  enrollments: number
  grades: number
}

const ALL_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Unknown Teacher'
  return [teacher.first_name, teacher.middle_name, teacher.last_name, teacher.suffix]
    .filter(Boolean)
    .join(' ')
}

function getPeriodOrder(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
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
    <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-green-950 sm:text-3xl">{value}</p>
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
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AdminSubmissionRow[]>([])
  const [selectedWindow, setSelectedWindow] = useState<GradingWindowRow | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

  const didInitializeRef = useRef(false)

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(gradingPeriod),
    [gradingPeriod]
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) =>
      [
        row.teacherName,
        row.teacherNo,
        row.subjectName,
        row.subjectCode,
        row.gradeLevel,
        row.section,
        row.schoolYear,
        row.gradingPeriod,
        row.isSubmitted ? 'submitted' : 'editable',
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    )
  }, [rows, search])

  const summary = useMemo(() => {
    const total = filteredRows.length
    const submitted = filteredRows.filter((row) => row.isSubmitted).length
    const editable = filteredRows.filter((row) => !row.isSubmitted).length
    const avgProgress =
      total > 0
        ? Math.round(filteredRows.reduce((sum, row) => sum + row.progress, 0) / total)
        : 0

    return {
      total,
      submitted,
      editable,
      avgProgress,
    }
  }, [filteredRows])

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message || 'Failed to load academic years.')
      setAcademicYears([])
      setSchoolYear('')
      return null
    }

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)

    if (yearRows.length === 0) {
      setSchoolYear('')
      return null
    }

    const activeYear = yearRows.find((row) => row.is_active)
    const selectedYear = activeYear?.school_year || yearRows[0].school_year
    setSchoolYear((prev) => prev || selectedYear)

    return selectedYear
  }

  const detectCurrentPeriod = async (selectedYear: string) => {
    const { data, error } = await supabase
      .from('grading_windows')
      .select(
        'id, school_year, semester, grading_period, is_open, is_locked, opened_by, locked_by, opened_at, locked_at, created_at, updated_at'
      )
      .eq('school_year', selectedYear)

    if (error) {
      toast.error(error.message || 'Failed to load grading windows.')
      return '1st' as GradingPeriod
    }

    const windows = (data ?? []) as GradingWindowRow[]

    const openWindow =
      windows
        .filter((w) => w.is_open && !w.is_locked)
        .sort((a, b) => getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period))[0] ??
      null

    if (openWindow) return openWindow.grading_period

    const latestWindow =
      windows
        .slice()
        .sort((a, b) => getPeriodOrder(b.grading_period) - getPeriodOrder(a.grading_period))[0] ??
      null

    return latestWindow?.grading_period ?? '1st'
  }

  const loadSelectedWindow = async (
    selectedYear: string,
    selectedPeriod: GradingPeriod
  ) => {
    if (!selectedYear) {
      setSelectedWindow(null)
      return
    }

    const semester = getSemesterFromPeriod(selectedPeriod)

    const { data, error } = await supabase
      .from('grading_windows')
      .select(
        'id, school_year, semester, grading_period, is_open, is_locked, opened_by, locked_by, opened_at, locked_at, created_at, updated_at'
      )
      .eq('school_year', selectedYear)
      .eq('semester', semester)
      .eq('grading_period', selectedPeriod)
      .maybeSingle()

    if (error) {
      toast.error(error.message || 'Failed to load grading window.')
      setSelectedWindow(null)
      return
    }

    setSelectedWindow((data as GradingWindowRow | null) ?? null)
  }

  const loadRows = async (selectedYear: string, selectedPeriod: GradingPeriod) => {
    if (!selectedYear) {
      setRows([])
      setDebugInfo(null)
      setLoading(false)
      return
    }

    const semester = getSemesterFromPeriod(selectedPeriod)
    setLoading(true)

    try {
      let { data: submissionsData, error: submissionsError } = await supabase
        .from('grade_submissions')
        .select(
          'id, class_id, teacher_id, school_year, term, grading_period, is_submitted, submitted_by, submitted_at'
        )
        .eq('school_year', selectedYear)
        .eq('term', semester)
        .eq('grading_period', selectedPeriod)
        .order('created_at', { ascending: false })

      if (submissionsError) throw submissionsError

      let submissions = (submissionsData ?? []) as GradeSubmissionRow[]

      if (submissions.length === 0) {
        const fallback = await supabase
          .from('grade_submissions')
          .select(
            'id, class_id, teacher_id, school_year, term, grading_period, is_submitted, submitted_by, submitted_at'
          )
          .eq('school_year', selectedYear)
          .eq('grading_period', selectedPeriod)
          .order('created_at', { ascending: false })

        if (fallback.error) throw fallback.error
        submissions = (fallback.data ?? []) as GradeSubmissionRow[]
      }

      if (submissions.length === 0) {
        setRows([])
        setDebugInfo({
          selectedYear,
          selectedPeriod,
          selectedSemester: semester,
          submissions: 0,
          classes: 0,
          enrollments: 0,
          grades: 0,
        })
        return
      }

      const classIds = Array.from(new Set(submissions.map((row) => row.class_id)))

      const [classesResult, enrollmentsResult, gradesResult] = await Promise.all([
        supabase
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
          .in('id', classIds),

        supabase
          .from('enrollments')
          .select('class_id, student_id')
          .eq('school_year', selectedYear)
          .eq('semester', semester)
          .in('class_id', classIds),

        supabase
          .from('grades')
          .select('class_id, student_id, semester, grading_period')
          .eq('school_year', selectedYear)
          .eq('semester', semester)
          .eq('grading_period', selectedPeriod)
          .in('class_id', classIds),
      ])

      if (classesResult.error) throw classesResult.error
      if (enrollmentsResult.error) throw enrollmentsResult.error
      if (gradesResult.error) throw gradesResult.error

      const classes = (classesResult.data ?? []) as ClassRow[]
      const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[]
      const grades = (gradesResult.data ?? []) as GradeRow[]

      setDebugInfo({
        selectedYear,
        selectedPeriod,
        selectedSemester: semester,
        submissions: submissions.length,
        classes: classes.length,
        enrollments: enrollments.length,
        grades: grades.length,
      })

      const classMap = new Map<string, ClassRow>()
      const enrollmentMap = new Map<string, Set<string>>()
      const gradeMap = new Map<string, Set<string>>()

      for (const cls of classes) {
        classMap.set(cls.id, cls)
      }

      for (const row of enrollments) {
        if (!enrollmentMap.has(row.class_id)) {
          enrollmentMap.set(row.class_id, new Set())
        }
        enrollmentMap.get(row.class_id)!.add(row.student_id)
      }

      for (const row of grades) {
        if (!gradeMap.has(row.class_id)) {
          gradeMap.set(row.class_id, new Set())
        }
        gradeMap.get(row.class_id)!.add(row.student_id)
      }

      const nextRows: AdminSubmissionRow[] = submissions
        .map((submission, index) => {
          const cls = classMap.get(submission.class_id)

          const enrolledStudents = enrollmentMap.get(submission.class_id) ?? new Set<string>()
          const gradedStudents = gradeMap.get(submission.class_id) ?? new Set<string>()

          let encodedStudents = 0
          for (const studentId of gradedStudents) {
            if (enrolledStudents.has(studentId)) encodedStudents += 1
          }

          const totalStudents = enrolledStudents.size
          const progress =
            totalStudents > 0 ? Math.round((encodedStudents / totalStudents) * 100) : 0

          return {
            key:
              submission.id ||
              `${submission.class_id}-${submission.term}-${submission.grading_period}-${index}`,
            submissionId: submission.id,
            classId: submission.class_id,
            teacherId: submission.teacher_id,
            teacherName: cls ? getTeacherName(cls.teachers) : 'Unknown Teacher',
            teacherNo: cls?.teachers?.teacher_no ?? '—',
            subjectName: cls?.subjects?.subject_name ?? 'Unknown Subject',
            subjectCode: cls?.subjects?.subject_code ?? '—',
            gradeLevel: cls?.grade_level ?? '—',
            section: cls?.section ?? '—',
            schoolYear: submission.school_year,
            semester: submission.term,
            gradingPeriod: submission.grading_period,
            totalStudents,
            encodedStudents,
            progress,
            isSubmitted: submission.is_submitted,
            submittedAt: submission.submitted_at,
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
      console.error('Admin grades load failed:', error)
      toast.error(error.message || 'Failed to load grade submissions.')
      setRows([])
      setDebugInfo(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const initialize = async () => {
    setLoading(true)

    const selectedYear = await loadAcademicYears()
    if (!selectedYear) {
      setLoading(false)
      return
    }

    const currentPeriod = await detectCurrentPeriod(selectedYear)
    setGradingPeriod(currentPeriod)

    await Promise.all([
      loadSelectedWindow(selectedYear, currentPeriod),
      loadRows(selectedYear, currentPeriod),
    ])

    didInitializeRef.current = true
    setLoading(false)
  }

  const reopenSubmission = async (row: AdminSubmissionRow) => {
    if (!selectedWindow) {
      toast.error('No grading window found for the selected grading period.')
      return
    }

    if (selectedWindow.is_locked) {
      toast.error('This grading period is locked. Unlock it first before allowing edits.')
      return
    }

    if (!selectedWindow.is_open) {
      toast.error('This grading period is closed. Open it first before allowing edits.')
      return
    }

    setReopeningId(row.submissionId)

    try {
      const { error } = await supabase
        .from('grade_submissions')
        .update({
          is_submitted: false,
          submitted_at: null,
          submitted_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.submissionId)

      if (error) throw error

      toast.success('Submission reopened. The teacher can edit grades again.')
      await loadRows(schoolYear, gradingPeriod)
    } catch (error: any) {
      toast.error(error.message || 'Failed to allow editing again.')
    } finally {
      setReopeningId(null)
    }
  }

  const handleRefresh = async () => {
    if (!schoolYear) return

    setRefreshing(true)
    await Promise.all([
      loadSelectedWindow(schoolYear, gradingPeriod),
      loadRows(schoolYear, gradingPeriod),
    ])
  }

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!didInitializeRef.current || !schoolYear) return

    loadSelectedWindow(schoolYear, gradingPeriod)
    loadRows(schoolYear, gradingPeriod)
  }, [schoolYear, gradingPeriod])

  const canRestoreAccess =
    !!selectedWindow && selectedWindow.is_open && !selectedWindow.is_locked

  return (
    <div className="space-y-5 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <p className="text-sm font-medium text-yellow-600">Administration</p>
        <h1 className="text-2xl font-bold text-green-900 sm:text-3xl">
          Grade Submission Management
        </h1>
        <p className="max-w-3xl text-sm text-gray-600 sm:text-base">
          Review submitted grades, monitor saved grade progress, and reopen submissions when a
          teacher needs to make corrections.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year
            </label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Grading Period
            </label>
            <select
              value={gradingPeriod}
              onChange={(e) => setGradingPeriod(e.target.value as GradingPeriod)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {ALL_PERIODS.map((period) => (
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
                placeholder="Search teacher, subject, or section"
                className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-60 xl:w-auto"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            Viewing <span className="font-semibold">{gradingPeriod} Grading Period</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedWindow?.is_open
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {selectedWindow?.is_open ? 'Window Open' : 'Window Closed'}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                selectedWindow?.is_locked
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {selectedWindow?.is_locked ? 'Window Locked' : 'Window Unlocked'}
            </span>
          </div>
        </div>
      </motion.div>

      {debugInfo && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm"
        >
          <p className="font-semibold">Data Check</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <p>Academic Year: {debugInfo.selectedYear}</p>
            <p>Grading Period: {debugInfo.selectedPeriod}</p>
            <p>Derived Semester: {debugInfo.selectedSemester}</p>
            <p>Submission Rows: {debugInfo.submissions}</p>
            <p>Class Rows: {debugInfo.classes}</p>
            <p>Enrollment Rows: {debugInfo.enrollments}</p>
            <p>Grade Rows: {debugInfo.grades}</p>
          </div>
        </motion.div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Submission Records"
          value={summary.total}
          subtitle="Classes with submission records in the selected period"
        />
        <SummaryCard
          title="Submitted"
          value={summary.submitted}
          subtitle="Classes already finalized by teachers"
        />
        <SummaryCard
          title="Editable"
          value={summary.editable}
          subtitle="Classes still open for teacher updates"
        />
        <SummaryCard
          title="Average Progress"
          value={`${summary.avgProgress}%`}
          subtitle="Saved grades compared with enrolled students"
        />
      </section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-green-100 p-2 text-green-800">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-green-900 sm:text-lg">
              Grading Window Status
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Reopening a submission is only available when the selected grading period is
              open and unlocked.
            </p>

            <div className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
              <p>
                Opened At:{' '}
                <span className="font-medium text-gray-900">
                  {formatDateTime(selectedWindow?.opened_at ?? null)}
                </span>
              </p>
              <p>
                Locked At:{' '}
                <span className="font-medium text-gray-900">
                  {formatDateTime(selectedWindow?.locked_at ?? null)}
                </span>
              </p>
            </div>

            {!selectedWindow && (
              <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                No grading window record exists for the selected academic year and period.
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-800" />
            <h2 className="text-lg font-bold text-green-900 sm:text-xl">
              Teacher Submission Records
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Teachers can be given editing access again after submission.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl bg-green-50 p-5 text-sm text-gray-500">
            Loading grade submissions...
          </div>
        ) : !schoolYear ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 text-sm text-yellow-800">
            No academic year is available. Create or activate an academic year first.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No grade submissions were found for the selected academic year and grading period.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((row) => {
              const hasSubmissionButNoGrades =
                row.isSubmitted && row.encodedStudents === 0 && row.totalStudents > 0

              return (
                <div
                  key={row.key}
                  className="rounded-2xl border border-green-100 bg-green-50 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-green-950 sm:text-xl">
                          {row.subjectName}
                        </h3>
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

                      <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          Teacher:{' '}
                          <span className="font-medium text-gray-900">{row.teacherName}</span>
                        </p>
                        <p>
                          Teacher No:{' '}
                          <span className="font-medium text-gray-900">{row.teacherNo}</span>
                        </p>
                        <p>
                          Students:{' '}
                          <span className="font-medium text-gray-900">{row.totalStudents}</span>
                        </p>
                        <p>
                          Saved Grades:{' '}
                          <span className="font-medium text-gray-900">
                            {row.encodedStudents}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4">
                        <ProgressBar value={row.progress} />
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <p className="font-medium text-gray-800">{row.progress}% complete</p>
                          {row.submittedAt && (
                            <p>
                              Submitted:{' '}
                              <span className="font-medium text-gray-900">
                                {formatDateTime(row.submittedAt)}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              row.isSubmitted
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {row.isSubmitted ? 'Submitted' : 'Editable'}
                          </span>

                          {hasSubmissionButNoGrades && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              No saved grades found
                            </span>
                          )}

                          {!hasSubmissionButNoGrades && row.isSubmitted && row.progress > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ready for review
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full xl:w-64">
                      {row.isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => reopenSubmission(row)}
                          disabled={!canRestoreAccess || reopeningId === row.submissionId}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                        >
                          {selectedWindow?.is_locked ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <LockOpen className="h-4 w-4" />
                          )}
                          {reopeningId === row.submissionId
                            ? 'Allowing Edit...'
                            : 'Allow Teacher to Edit'}
                        </button>
                      ) : (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                          This class is still open for teacher updates because it has not been
                          finalized yet.
                        </div>
                      )}

                      {row.isSubmitted && !canRestoreAccess && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          Open and unlock this grading period first before allowing edits.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.section>
    </div>
  )
}