'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Lock,
  LockOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
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
  opened_at: string | null
  locked_at: string | null
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

type SubmissionRow = {
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
  gradingPeriod: GradingPeriod
  isSubmitted: boolean
  submittedAt: string | null
}

const ALL_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getPeriodOrder(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Unknown Teacher'
  return [teacher.first_name, teacher.middle_name, teacher.last_name, teacher.suffix]
    .filter(Boolean)
    .join(' ')
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
    <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-green-900">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}

export default function AdminGradesPage() {
  const initializedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reopeningId, setReopeningId] = useState<string | null>(null)

  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] =
    useState<GradingPeriod>('1st')
  const [selectedWindow, setSelectedWindow] = useState<GradingWindowRow | null>(null)

  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [search, setSearch] = useState('')

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
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

    return {
      total,
      submitted,
      editable,
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
      setSelectedSchoolYear('')
      return null
    }

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)

    if (yearRows.length === 0) {
      setSelectedSchoolYear('')
      return null
    }

    const activeYear = yearRows.find((row) => row.is_active)
    const nextYear = activeYear?.school_year || yearRows[0].school_year

    setSelectedSchoolYear((prev) => prev || nextYear)
    return nextYear
  }

  const detectCurrentPeriod = async (schoolYear: string) => {
    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked, opened_at, locked_at')
      .eq('school_year', schoolYear)

    if (error) {
      toast.error(error.message || 'Failed to load grading windows.')
      return '1st' as GradingPeriod
    }

    const windows = (data ?? []) as GradingWindowRow[]

    const openWindow =
      windows
        .filter((item) => item.is_open && !item.is_locked)
        .sort((a, b) => getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period))[0] ??
      null

    if (openWindow) return openWindow.grading_period

    const fallbackWindow =
      windows
        .slice()
        .sort((a, b) => getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period))[0] ??
      null

    return fallbackWindow?.grading_period ?? '1st'
  }

  const loadSpecificWindow = async (
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    if (!schoolYear) {
      setSelectedWindow(null)
      return
    }

    const semester = getSemesterFromPeriod(gradingPeriod)

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked, opened_at, locked_at')
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .eq('grading_period', gradingPeriod)
      .maybeSingle()

    if (error) {
      toast.error(error.message || 'Failed to load grading window.')
      setSelectedWindow(null)
      return
    }

    setSelectedWindow((data as GradingWindowRow | null) ?? null)
  }

  const loadRows = async (schoolYear: string, gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      setRows([])
      setLoading(false)
      return
    }

    const semester = getSemesterFromPeriod(gradingPeriod)
    setLoading(true)

    try {
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('grade_submissions')
        .select(
          'id, class_id, teacher_id, school_year, term, grading_period, is_submitted, submitted_by, submitted_at'
        )
        .eq('school_year', schoolYear)
        .eq('term', semester)
        .eq('grading_period', gradingPeriod)
        .order('created_at', { ascending: false })

      if (submissionsError) throw submissionsError

      const submissions = (submissionsData ?? []) as GradeSubmissionRow[]

      if (submissions.length === 0) {
        setRows([])
        return
      }

      const classIds = Array.from(new Set(submissions.map((item) => item.class_id)))

      const { data: classData, error: classError } = await supabase
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
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .in('id', classIds)

      if (classError) throw classError

      const classes = (classData ?? []) as ClassRow[]
      const classMap = new Map<string, ClassRow>()

      for (const item of classes) {
        classMap.set(item.id, item)
      }

      const builtRows: SubmissionRow[] = submissions
        .map((submission, index) => {
          const cls = classMap.get(submission.class_id)

          return {
            key: submission.id || `${submission.class_id}-${index}`,
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
            gradingPeriod: submission.grading_period,
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

      setRows(builtRows)
    } catch (error: any) {
      console.error('AdminGradesPage loadRows error:', error)
      toast.error(error.message || 'Failed to load submission records.')
      setRows([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const initialize = async () => {
    setLoading(true)

    const schoolYear = await loadAcademicYears()
    if (!schoolYear) {
      setLoading(false)
      return
    }

    const currentPeriod = await detectCurrentPeriod(schoolYear)
    setSelectedGradingPeriod(currentPeriod)

    await Promise.all([
      loadSpecificWindow(schoolYear, currentPeriod),
      loadRows(schoolYear, currentPeriod),
    ])

    initializedRef.current = true
    setLoading(false)
  }

  const handleRefresh = async () => {
    if (!selectedSchoolYear) return

    setRefreshing(true)
    await Promise.all([
      loadSpecificWindow(selectedSchoolYear, selectedGradingPeriod),
      loadRows(selectedSchoolYear, selectedGradingPeriod),
    ])
    toast.success('Submission records refreshed.')
  }

  const reopenSubmission = async (row: SubmissionRow) => {
    if (!selectedWindow) {
      toast.error('No grading window found for the selected grading period.')
      return
    }

    if (!selectedWindow.is_open) {
      toast.error('This grading period is closed. Open it first before allowing edits.')
      return
    }

    if (selectedWindow.is_locked) {
      toast.error('This grading period is locked. Unlock it first before allowing edits.')
      return
    }

    setReopeningId(row.submissionId)

    try {
      const { error } = await supabase
        .from('grade_submissions')
        .update({
          is_submitted: false,
          submitted_by: null,
          submitted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.submissionId)

      if (error) throw error

      toast.success('Submission reopened. The teacher can edit grades again.')
      await loadRows(selectedSchoolYear, selectedGradingPeriod)
    } catch (error: any) {
      toast.error(error.message || 'Failed to reopen submission.')
    } finally {
      setReopeningId(null)
    }
  }

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!initializedRef.current || !selectedSchoolYear) return
    loadSpecificWindow(selectedSchoolYear, selectedGradingPeriod)
    loadRows(selectedSchoolYear, selectedGradingPeriod)
  }, [selectedSchoolYear, selectedGradingPeriod])

  const canRestoreAccess =
    !!selectedWindow && selectedWindow.is_open && !selectedWindow.is_locked

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 p-5 text-white shadow-xl sm:p-6"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-300">Administration</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Grade Submission Management
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-green-50/90">
              Review class submission records and reopen finalized submissions when a teacher needs to make corrections.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 xl:grid-cols-[220px_220px_1fr_auto]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year
            </label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Grading Period
            </label>
            <select
              value={selectedGradingPeriod}
              onChange={(e) => setSelectedGradingPeriod(e.target.value as GradingPeriod)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {ALL_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period} Grading Period
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teacher, subject, grade level, or section"
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

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            Viewing {selectedGradingPeriod} Grading Period
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
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Submission Records"
          value={summary.total}
          subtitle="Classes with submission records for this period"
        />
        <SummaryCard
          title="Submitted"
          value={summary.submitted}
          subtitle="Classes already finalized by teachers"
        />
        <SummaryCard
          title="Editable"
          value={summary.editable}
          subtitle="Classes currently open for teacher updates"
        />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-green-100 p-2 text-green-800">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-green-900">Grading Window Status</h2>
            <p className="mt-1 text-sm text-gray-600">
              Reopening a submitted class is only available when this grading period is open and unlocked.
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
              <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                No grading window record exists for this academic year and grading period.
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-green-900">Submission Records</h2>
            <p className="text-sm text-gray-600">
              This page reads submission status from the submission records created during teacher final submit.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            <UserCheck className="h-4 w-4" />
            {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            Loading submission records...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No submission records were found for this academic year and grading period.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((row) => (
              <div
                key={row.key}
                className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-green-900">
                        {row.subjectName}
                      </h3>
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                        {row.subjectCode}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        {row.gradeLevel}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        Section {row.section}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 xl:grid-cols-4">
                      <p>
                        Teacher:{' '}
                        <span className="font-medium text-gray-900">{row.teacherName}</span>
                      </p>
                      <p>
                        Teacher No:{' '}
                        <span className="font-medium text-gray-900">{row.teacherNo}</span>
                      </p>
                      <p>
                        Academic Year:{' '}
                        <span className="font-medium text-gray-900">{row.schoolYear}</span>
                      </p>
                      <p>
                        Submitted At:{' '}
                        <span className="font-medium text-gray-900">
                          {formatDateTime(row.submittedAt)}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          row.isSubmitted
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-900'
                        }`}
                      >
                        {row.isSubmitted ? 'Submitted' : 'Editable'}
                      </span>

                      {row.isSubmitted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Finalized by teacher
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-full xl:w-64">
                    {row.isSubmitted ? (
                      <button
                        type="button"
                        onClick={() => reopenSubmission(row)}
                        disabled={!canRestoreAccess || reopeningId === row.submissionId}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                        This class is already open for teacher editing because it is not finalized.
                      </div>
                    )}

                    {row.isSubmitted && !canRestoreAccess && (
                      <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        Open and unlock the grading period first before allowing edits.
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