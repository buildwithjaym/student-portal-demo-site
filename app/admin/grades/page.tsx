'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  LockOpen,
  RefreshCw,
  Search,
  UserCheck,
  X,
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

type RawClassRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  school_year: string
  semester: Semester
  is_active: boolean
  subjects: SubjectRow[] | SubjectRow | null
  teachers: TeacherRow[] | TeacherRow | null
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

function getSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeClassRow(row: RawClassRow): ClassRow {
  return {
    id: row.id,
    subject_id: row.subject_id,
    teacher_id: row.teacher_id,
    grade_level: row.grade_level,
    section: row.section,
    school_year: row.school_year,
    semester: row.semester,
    is_active: row.is_active,
    subjects: getSingleRelation(row.subjects),
    teachers: getSingleRelation(row.teachers),
  }
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

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null)

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
      .select(
        'id, school_year, semester, grading_period, is_open, is_locked, opened_at, locked_at'
      )
      .eq('school_year', schoolYear)

    if (error) {
      toast.error(error.message || 'Failed to load grading windows.')
      return '1st' as GradingPeriod
    }

    const windows = (data ?? []) as GradingWindowRow[]

    const openWindow =
      windows
        .filter((item) => item.is_open && !item.is_locked)
        .sort(
          (a, b) =>
            getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period)
        )[0] ?? null

    if (openWindow) return openWindow.grading_period

    const fallbackWindow =
      windows
        .slice()
        .sort(
          (a, b) =>
            getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period)
        )[0] ?? null

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
      .select(
        'id, school_year, semester, grading_period, is_open, is_locked, opened_at, locked_at'
      )
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

      const classes = ((classData ?? []) as RawClassRow[]).map(normalizeClassRow)
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

  const requestReopenSubmission = (row: SubmissionRow) => {
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

    setSelectedSubmission(row)
    setConfirmOpen(true)
  }

  const closeConfirmation = () => {
    if (reopeningId) return
    setConfirmOpen(false)
    setSelectedSubmission(null)
  }

  const reopenSubmission = async () => {
    if (!selectedSubmission) return

    setReopeningId(selectedSubmission.submissionId)

    try {
      const { error } = await supabase
        .from('grade_submissions')
        .update({
          is_submitted: false,
          submitted_by: null,
          submitted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSubmission.submissionId)

      if (error) throw error

      toast.success('Submission reopened. The teacher can edit grades again.')
      closeConfirmation()
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
    <>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs font-medium text-cyan-600 sm:text-sm">Administration</p>
          <h1 className="text-3xl font-bold text-slate-900">Grades</h1>
          <p className="text-slate-600">
            View submission records and reopen submitted grades when teachers need to make corrections.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Academic Year
              </label>
              <select
                value={selectedSchoolYear}
                onChange={(e) => setSelectedSchoolYear(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-green-200"
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
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Grading Period
              </label>
              <select
                value={selectedGradingPeriod}
                onChange={(e) => setSelectedGradingPeriod(e.target.value as GradingPeriod)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-green-200"
              >
                {ALL_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period} Grading Period
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teacher, subject, grade level, or section"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60 xl:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              {selectedSemester} • {selectedGradingPeriod} Grading Period
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedWindow?.is_open
                    ? 'bg-cyan-100 text-cyan-700'
                    : 'bg-slate-200 text-slate-700'
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
                {selectedWindow?.is_locked ? 'Locked' : 'Unlocked'}
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Submission Records</h2>
              <p className="text-sm text-slate-600">
                Read submission status and restore grade access when needed.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700">
              <UserCheck className="h-4 w-4" />
              {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl bg-cyan-50 p-5 text-slate-500">
              Loading submission records...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              No submission records were found for this academic year and grading period.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {row.subjectName}
                        </h3>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-700">
                          {row.subjectCode}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {row.gradeLevel}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Section {row.section}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                        <p>
                          Teacher:{' '}
                          <span className="font-medium text-slate-900">{row.teacherName}</span>
                        </p>
                        <p>
                          Teacher No:{' '}
                          <span className="font-medium text-slate-900">{row.teacherNo}</span>
                        </p>
                        <p>
                          Academic Year:{' '}
                          <span className="font-medium text-slate-900">{row.schoolYear}</span>
                        </p>
                        <p>
                          Submitted At:{' '}
                          <span className="font-medium text-slate-900">
                            {formatDateTime(row.submittedAt)}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.isSubmitted
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          {row.isSubmitted ? 'Submitted' : 'Editable'}
                        </span>

                        {row.isSubmitted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Finalized
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full xl:w-60">
                      {row.isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => requestReopenSubmission(row)}
                          disabled={!canRestoreAccess || reopeningId === row.submissionId}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                        <div className="rounded-xl border border-yellow-200 bg-cyan-50 p-4 text-sm text-cyan-800">
                          This class is already open for teacher editing.
                        </div>
                      )}

                      {row.isSubmitted && !canRestoreAccess && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          Open and unlock the grading period first before allowing edits.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {confirmOpen && selectedSubmission && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeConfirmation}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-md rounded-2xl border border-cyan-100 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Allow teacher to edit again?
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      This will reopen the submitted record and allow the teacher to update grades again.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeConfirmation}
                  disabled={!!reopeningId}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-gray-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">{selectedSubmission.subjectName}</p>
                <div className="mt-2 space-y-1 text-slate-600">
                  <p>
                    Teacher:{' '}
                    <span className="font-medium text-slate-900">
                      {selectedSubmission.teacherName}
                    </span>
                  </p>
                  <p>
                    Section:{' '}
                    <span className="font-medium text-slate-900">
                      {selectedSubmission.gradeLevel} • Section {selectedSubmission.section}
                    </span>
                  </p>
                  <p>
                    Academic Year:{' '}
                    <span className="font-medium text-slate-900">
                      {selectedSubmission.schoolYear}
                    </span>
                  </p>
                  <p>
                    Grading Period:{' '}
                    <span className="font-medium text-slate-900">
                      {selectedSubmission.gradingPeriod} Grading Period
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeConfirmation}
                  disabled={!!reopeningId}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={reopenSubmission}
                  disabled={!!reopeningId}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                >
                  <LockOpen className="h-4 w-4" />
                  {reopeningId ? 'Allowing Edit...' : 'Yes, Allow Edit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}