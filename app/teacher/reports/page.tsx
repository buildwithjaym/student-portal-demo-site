'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  GraduationCap,
  Info,
  Lock,
  Save,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
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

type StudentRow = {
  id: string
  student_no?: string | null
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  gender?: 'Male' | 'Female' | null
}

type EnrollmentQueryRow = {
  student_id: string
  students: StudentRow | null
}

type GradeRow = {
  student_id: string
  grade: number
  remarks: string | null
}

type GradingWindowRow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
}

type GradeSubmissionRow = {
  id: string
  is_submitted: boolean
  submitted_at: string | null
}

type StudentGradeInput = {
  student_id: string
  student_no: string
  full_name: string
  gender: string
  grade: string
  remarks: string
}

type SubmitGradePayload = {
  student_id: string
  class_id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  grade: number
  remarks: string | null
  encoded_by: string
}

type SupabaseLikeError = {
  message?: string | null
  details?: string | null
  hint?: string | null
  code?: string | null
}

type RawClassRow = Omit<ClassRow, 'subjects'> & {
  subjects: SubjectRow[] | SubjectRow | null
}

type RawEnrollmentQueryRow = {
  student_id: string
  students: StudentRow[] | StudentRow | null
}

type InitialQueryState = {
  classId: string
  schoolYear: string
  gradingPeriod: GradingPeriod | null
}

const ALL_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

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
  }
}

function normalizeEnrollmentRow(row: RawEnrollmentQueryRow): EnrollmentQueryRow {
  return {
    student_id: row.student_id,
    students: getSingleRelation(row.students),
  }
}

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getPeriodSortValue(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

function isValidGradingPeriod(value: string | null): value is GradingPeriod {
  return value === '1st' || value === '2nd' || value === '3rd' || value === '4th'
}

function readInitialQueryState(): InitialQueryState {
  if (typeof window === 'undefined') {
    return {
      classId: '',
      schoolYear: '',
      gradingPeriod: null,
    }
  }

  const params = new URLSearchParams(window.location.search)
  const gradingPeriodValue = params.get('gradingPeriod')

  return {
    classId: params.get('classId') || '',
    schoolYear: params.get('schoolYear') || '',
    gradingPeriod: isValidGradingPeriod(gradingPeriodValue) ? gradingPeriodValue : null,
  }
}

function getGradeError(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Required'

  const numericGrade = Number(trimmed)
  if (Number.isNaN(numericGrade)) return 'Invalid number'
  if (numericGrade < 0 || numericGrade > 100) return 'Must be 0 to 100'

  return null
}

function getReadableError(error: unknown, fallback: string) {
  if (!error) return fallback
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    const err = error as SupabaseLikeError
    return err.message || err.details || err.hint || err.code || fallback
  }

  return fallback
}

function debugDbError(label: string, error: unknown, extra?: Record<string, unknown>) {
  const err = (error ?? {}) as SupabaseLikeError

  console.error(`\n[${label}]`)
  console.error('message:', err.message ?? null)
  console.error('details:', err.details ?? null)
  console.error('hint:', err.hint ?? null)
  console.error('code:', err.code ?? null)

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      console.error(`${key}:`, value)
    }
  }

  console.error(`[/${label}]\n`)
}

function formatSubmittedAt(value: string | null) {
  if (!value) return 'Already submitted'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Already submitted'
  return `Submitted on ${date.toLocaleString()}`
}

function normalizeGradeInput(value: string) {
  let next = value.replace(/[^\d.]/g, '')
  const parts = next.split('.')

  if (parts.length > 2) {
    next = `${parts[0]}.${parts.slice(1).join('')}`
  }

  const normalizedParts = next.split('.')
  if (normalizedParts[1]?.length > 2) {
    next = `${normalizedParts[0]}.${normalizedParts[1].slice(0, 2)}`
  }

  return next
}

function getHonorLabel(grade?: number | null) {
  if (grade === null || grade === undefined || Number.isNaN(Number(grade))) {
    return 'No Grade'
  }

  const value = Number(grade)

  if (value < 75) return 'Failed'
  if (value <= 89) return 'Passed'
  if (value <= 94) return 'With Honors'
  if (value <= 98) return 'With High Honors'
  if (value <= 100) return 'With Highest Honors'
  return 'Invalid Grade'
}

function getStatusToneClasses(tone: 'success' | 'warning' | 'danger' | 'info') {
  if (tone === 'success') return 'border-green-200 bg-green-50 text-green-800'
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700'
  if (tone === 'warning') return 'border-yellow-200 bg-yellow-50 text-yellow-900'
  return 'border-blue-200 bg-blue-50 text-blue-800'
}

function getInputToneClasses(hasError: boolean) {
  if (hasError) {
    return 'border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100'
  }

  return 'border-gray-300 focus:border-green-700 focus:ring-green-200'
}

export default function TeacherGradesPage() {
  const router = useRouter()

  const initializedRef = useRef(false)
  const restrictionToastKeyRef = useRef('')
  const queryStateRef = useRef<InitialQueryState>({
    classId: '',
    schoolYear: '',
    gradingPeriod: null,
  })

  const [loading, setLoading] = useState(true)
  const [savingDraft, setSavingDraft] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [profileId, setProfileId] = useState('')

  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState<GradingPeriod>('1st')
  const [availablePeriods, setAvailablePeriods] = useState<GradingPeriod[]>(ALL_PERIODS)

  const [teacherClasses, setTeacherClasses] = useState<ClassRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null)

  const [gradingWindow, setGradingWindow] = useState<GradingWindowRow | null>(null)
  const [gradeSubmission, setGradeSubmission] = useState<GradeSubmissionRow | null>(null)
  const [savedGradeCount, setSavedGradeCount] = useState(0)

  const [rows, setRows] = useState<StudentGradeInput[]>([])
  const [search, setSearch] = useState('')
  const [classSearch, setClassSearch] = useState('')

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const inconsistentSubmittedState =
    gradeSubmission?.is_submitted === true && savedGradeCount === 0 && rows.length > 0

  const canEncodeGrades =
    gradingWindow?.is_open === true &&
    gradingWindow?.is_locked === false &&
    (!gradeSubmission?.is_submitted || inconsistentSubmittedState)

  const filteredClasses = useMemo(() => {
    const keyword = classSearch.trim().toLowerCase()
    if (!keyword) return teacherClasses

    return teacherClasses.filter((item) => {
      const code = item.subjects?.subject_code?.toLowerCase() ?? ''
      const name = item.subjects?.subject_name?.toLowerCase() ?? ''
      const gradeLevel = item.grade_level.toLowerCase()
      const section = item.section.toLowerCase()

      return (
        code.includes(keyword) ||
        name.includes(keyword) ||
        gradeLevel.includes(keyword) ||
        section.includes(keyword)
      )
    })
  }, [teacherClasses, classSearch])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) => {
      return (
        row.student_no.toLowerCase().includes(keyword) ||
        row.full_name.toLowerCase().includes(keyword) ||
        row.gender.toLowerCase().includes(keyword) ||
        row.grade.toLowerCase().includes(keyword) ||
        row.remarks.toLowerCase().includes(keyword)
      )
    })
  }, [rows, search])

  const previewSummary = useMemo(() => {
    const completed = rows.filter((row) => row.grade.trim() !== '').length
    const invalid = rows.filter((row) => getGradeError(row.grade) !== null).length
    const validNumericRows = rows.filter((row) => getGradeError(row.grade) === null)

    const average =
      validNumericRows.length > 0
        ? (
            validNumericRows.reduce((sum, row) => sum + Number(row.grade), 0) /
            validNumericRows.length
          ).toFixed(2)
        : '0.00'

    return {
      total: rows.length,
      completed,
      invalid,
      average,
    }
  }, [rows])

  const selectedClassLabel = selectedClass
    ? `${selectedClass.subjects?.subject_code ?? '—'} - ${selectedClass.subjects?.subject_name ?? 'Unnamed Subject'}`
    : 'No class selected'

  const statusMessage = useMemo(() => {
    if (!selectedClassId) {
      return {
        tone: 'info' as const,
        title: 'Select a class',
        description: 'Choose a class and start entering grades.',
      }
    }

    if (!gradingWindow) {
      return {
        tone: 'warning' as const,
        title: 'No grading window',
        description: 'This academic year and grading period has no active window yet.',
      }
    }

    if (!gradingWindow.is_open) {
      return {
        tone: 'warning' as const,
        title: 'Grading closed',
        description: 'You can view saved grades, but editing is currently disabled.',
      }
    }

    if (gradingWindow.is_locked) {
      return {
        tone: 'danger' as const,
        title: 'Grading locked',
        description: 'This grading period is locked. Grades are read-only.',
      }
    }

    if (inconsistentSubmittedState) {
      return {
        tone: 'warning' as const,
        title: 'Submission needs repair',
        description:
          'A submission record exists without saved grade rows. You may resubmit this class.',
      }
    }

    if (gradeSubmission?.is_submitted) {
      return {
        tone: 'success' as const,
        title: 'Already submitted',
        description: `${formatSubmittedAt(
          gradeSubmission.submitted_at
        )}. These grades are now read-only.`,
      }
    }

    return {
      tone: 'success' as const,
      title: 'Ready to submit',
      description: 'You can enter grades and submit this class now.',
    }
  }, [selectedClassId, gradingWindow, gradeSubmission, inconsistentSubmittedState])

  const resetGradeState = () => {
    setSelectedClass(null)
    setRows([])
    setGradeSubmission(null)
    setSavedGradeCount(0)
  }

  const notifyRestrictionOnce = (message: string) => {
    if (restrictionToastKeyRef.current === message) return
    restrictionToastKeyRef.current = message
    toast.info(message)
  }

  const getBlockedReason = () => {
    if (!selectedClassId) return 'Select a class first.'
    if (!gradingWindow) return 'No grading window found.'
    if (!gradingWindow.is_open) return 'Grading is closed.'
    if (gradingWindow.is_locked) return 'This grading period is locked.'
    if (gradeSubmission?.is_submitted && !inconsistentSubmittedState) {
      return 'Grades are already submitted.'
    }
    return null
  }

  const loadGuard = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      debugDbError('TeacherGradesPage auth.getUser failed', userError)
      toast.error('Please log in first.')
      router.replace('/login')
      return null
    }

    setProfileId(user.id)

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, is_active, must_change_password')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profileData) {
      debugDbError('TeacherGradesPage profiles lookup failed', profileError, {
        userId: user.id,
      })
      toast.error('Failed to load profile.')
      router.replace('/login')
      return null
    }

    const profileRow = profileData as ProfileRow

    if (!profileRow.is_active) {
      toast.error('Account inactive.')
      await supabase.auth.signOut()
      router.replace('/login')
      return null
    }

    if (profileRow.must_change_password) {
      toast.info('Please change your password first.')
      router.replace('/change-password')
      return null
    }

    if (profileRow.role !== 'teacher') {
      toast.error('Teachers only.')
      router.replace('/login')
      return null
    }

    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select(
        'id, profile_id, teacher_no, first_name, middle_name, last_name, suffix, is_active'
      )
      .eq('profile_id', user.id)
      .maybeSingle()

    if (teacherError || !teacherData) {
      debugDbError('TeacherGradesPage teachers lookup failed', teacherError, {
        userId: user.id,
      })
      toast.error('Teacher record not found.')
      router.replace('/login')
      return null
    }

    const teacherRow = teacherData as TeacherRow

    if (!teacherRow.is_active) {
      toast.error('Teacher account inactive.')
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
      debugDbError('TeacherGradesPage academic_years load failed', error)
      toast.error(getReadableError(error, 'Failed to load academic years.'))
      setAcademicYears([])
      return []
    }

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)
    return yearRows
  }

  const loadWindowsAndCurrentPeriod = async (
    schoolYear: string,
    options?: { preserveSelectedPeriod?: boolean }
  ) => {
    if (!schoolYear) {
      setAvailablePeriods(ALL_PERIODS)
      setGradingWindow(null)
      return
    }

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', schoolYear)

    if (error) {
      debugDbError('TeacherGradesPage grading_windows load failed', error, {
        schoolYear,
      })
      toast.error(getReadableError(error, 'Failed to load grading windows.'))
      setAvailablePeriods(ALL_PERIODS)
      setGradingWindow(null)
      return
    }

    const windowRows = (data ?? []) as GradingWindowRow[]

    const uniquePeriods = Array.from(
      new Set(windowRows.map((row) => row.grading_period as GradingPeriod))
    ).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b))

    setAvailablePeriods(uniquePeriods.length > 0 ? uniquePeriods : ALL_PERIODS)

    if (options?.preserveSelectedPeriod) {
      return
    }

    const openWindow =
      windowRows
        .filter((row) => row.is_open && !row.is_locked)
        .sort(
          (a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
        )[0] ?? null

    const fallbackWindow =
      windowRows
        .slice()
        .sort(
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
      debugDbError('TeacherGradesPage specific grading_window load failed', error, {
        schoolYear,
        gradingPeriod,
        semester,
      })
      toast.error(getReadableError(error, 'Failed to load grading window.'))
      setGradingWindow(null)
      return
    }

    setGradingWindow((data as GradingWindowRow | null) ?? null)
  }

  const loadTeacherClasses = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear) {
      setTeacherClasses([])
      setSelectedClassId('')
      return
    }

    const { data, error } = await supabase
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

    if (error) {
      debugDbError('TeacherGradesPage classes load failed', error, {
        teacherId,
        schoolYear,
        gradingPeriod,
        semester,
      })
      toast.error(getReadableError(error, 'Failed to load classes.'))
      setTeacherClasses([])
      return
    }

    const classRows = ((data ?? []) as RawClassRow[]).map(normalizeClassRow)
    setTeacherClasses(classRows)

    if (classRows.length === 0) {
      setSelectedClassId('')
      return
    }

    setSelectedClassId((prev) => {
      if (!prev) {
        return queryStateRef.current.classId || classRows[0].id
      }

      const stillExists = classRows.some((item) => item.id === prev)
      return stillExists ? prev : classRows[0]?.id ?? ''
    })
  }

  const loadSelectedClassData = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod,
    classId: string
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear || !classId) {
      resetGradeState()
      return
    }

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
        )
      `)
      .eq('id', classId)
      .eq('teacher_id', teacherId)
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .maybeSingle()

    if (classError || !classData) {
      debugDbError('TeacherGradesPage selected class load failed', classError, {
        teacherId,
        schoolYear,
        gradingPeriod,
        semester,
        classId,
      })
      toast.error('Class not found.')
      resetGradeState()
      return
    }

    setSelectedClass(normalizeClassRow(classData as RawClassRow))

    const [enrollmentsResult, gradesResult, submissionResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select(`
          student_id,
          students:student_id (
            id,
            student_no,
            first_name,
            middle_name,
            last_name,
            suffix,
            gender
          )
        `)
        .eq('class_id', classId)
        .eq('school_year', schoolYear)
        .eq('semester', semester),

      supabase
        .from('grades')
        .select('student_id, grade, remarks')
        .eq('class_id', classId)
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .eq('grading_period', gradingPeriod),

      supabase
        .from('grade_submissions')
        .select('id, is_submitted, submitted_at')
        .eq('class_id', classId)
        .eq('school_year', schoolYear)
        .eq('term', semester)
        .eq('grading_period', gradingPeriod)
        .maybeSingle(),
    ])

    if (enrollmentsResult.error) {
      debugDbError('TeacherGradesPage enrollments load failed', enrollmentsResult.error, {
        classId,
        schoolYear,
        semester,
      })
      toast.error(getReadableError(enrollmentsResult.error, 'Failed to load students.'))
      setRows([])
      setSavedGradeCount(0)
      return
    }

    if (gradesResult.error) {
      debugDbError('TeacherGradesPage grades load failed', gradesResult.error, {
        classId,
        schoolYear,
        semester,
        gradingPeriod,
      })
      toast.error(getReadableError(gradesResult.error, 'Failed to load grades.'))
      setRows([])
      setSavedGradeCount(0)
      return
    }

    if (submissionResult.error) {
      debugDbError(
        'TeacherGradesPage grade_submissions load failed',
        submissionResult.error,
        {
          classId,
          schoolYear,
          semester,
          gradingPeriod,
        }
      )
      toast.error(getReadableError(submissionResult.error, 'Failed to load submission status.'))
      setRows([])
      setSavedGradeCount(0)
      return
    }

    const enrollments = ((enrollmentsResult.data ?? []) as RawEnrollmentQueryRow[]).map(
      normalizeEnrollmentRow
    )
    const grades = (gradesResult.data ?? []) as GradeRow[]
    const submissionData = (submissionResult.data as GradeSubmissionRow | null) ?? null

    setGradeSubmission(submissionData)
    setSavedGradeCount(grades.length)

    const gradeMap = new Map<string, GradeRow>()
    grades.forEach((item) => gradeMap.set(item.student_id, item))

    const builtRows: StudentGradeInput[] = enrollments
      .filter((item) => item.students)
      .map((item) => {
        const student = item.students as StudentRow
        const existingGrade = gradeMap.get(student.id)

        return {
          student_id: student.id,
          student_no: student.student_no ?? '',
          full_name: formatFullName(student),
          gender: student.gender ?? '—',
          grade:
            existingGrade?.grade !== undefined && existingGrade?.grade !== null
              ? String(existingGrade.grade)
              : '',
          remarks: existingGrade?.remarks ?? '',
        }
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))

    setRows(builtRows)

    if (submissionData?.is_submitted && grades.length === 0 && enrollments.length > 0) {
      toast.warning(
        'Submission exists but no saved grades were found. You may resubmit to repair this class.'
      )
    }
  }

  useEffect(() => {
    queryStateRef.current = readInitialQueryState()

    const initialize = async () => {
      setLoading(true)

      if (queryStateRef.current.classId) {
        setSelectedClassId(queryStateRef.current.classId)
      }

      if (queryStateRef.current.schoolYear) {
        setSelectedSchoolYear(queryStateRef.current.schoolYear)
      }

      if (queryStateRef.current.gradingPeriod) {
        setSelectedGradingPeriod(queryStateRef.current.gradingPeriod)
      }

      const teacherRow = await loadGuard()
      if (!teacherRow) {
        setLoading(false)
        return
      }

      const years = await loadAcademicYears()
      const activeYear =
        queryStateRef.current.schoolYear ||
        years.find((row) => row.is_active)?.school_year ||
        years[0]?.school_year ||
        ''

      if (activeYear) {
        setSelectedSchoolYear((prev) => prev || activeYear)
        await loadWindowsAndCurrentPeriod(activeYear, {
          preserveSelectedPeriod: Boolean(queryStateRef.current.gradingPeriod),
        })
      }

      initializedRef.current = true
      setLoading(false)
      toast.success('Grade encoding page loaded.')
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!initializedRef.current || !selectedSchoolYear) return

    loadWindowsAndCurrentPeriod(selectedSchoolYear, {
      preserveSelectedPeriod: Boolean(queryStateRef.current.gradingPeriod),
    })
  }, [selectedSchoolYear])

  useEffect(() => {
    if (!selectedSchoolYear) return
    loadSpecificWindow(selectedSchoolYear, selectedGradingPeriod)
  }, [selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear) return
    loadTeacherClasses(teacher.id, selectedSchoolYear, selectedGradingPeriod)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear || !selectedClassId) {
      if (!selectedClassId) resetGradeState()
      return
    }

    loadSelectedClassData(
      teacher.id,
      selectedSchoolYear,
      selectedGradingPeriod,
      selectedClassId
    )
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod, selectedClassId])

  useEffect(() => {
    restrictionToastKeyRef.current = ''
  }, [selectedClassId, selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (loading || !selectedClassId) return

    if (!gradingWindow) {
      notifyRestrictionOnce('No grading window found.')
      return
    }

    if (!gradingWindow.is_open) {
      notifyRestrictionOnce('Grading is closed.')
      return
    }

    if (gradingWindow.is_locked) {
      notifyRestrictionOnce('This grading period is locked.')
      return
    }

    if (inconsistentSubmittedState) {
      notifyRestrictionOnce('Submission exists without grades. You may resubmit.')
      return
    }

    if (gradeSubmission?.is_submitted) {
      notifyRestrictionOnce('Grades are already submitted.')
    }
  }, [loading, selectedClassId, gradingWindow, gradeSubmission, inconsistentSubmittedState])

  const handleClassSelect = async (classId: string) => {
    setSelectedClassId(classId)

    if (!teacher?.id || !selectedSchoolYear || !classId) return

    const chosenClass = teacherClasses.find((item) => item.id === classId)

    toast.loading('Loading class data...', { id: 'load-class' })

    await loadSelectedClassData(
      teacher.id,
      selectedSchoolYear,
      selectedGradingPeriod,
      classId
    )

    toast.dismiss('load-class')
    toast.success(
      `${chosenClass?.subjects?.subject_code ?? 'Class'} • ${chosenClass?.section ?? ''} loaded.`
    )
  }

  const handleRowChange = (studentId: string, field: 'grade' | 'remarks', value: string) => {
    const blockedReason = getBlockedReason()
    if (blockedReason) {
      toast.warning(blockedReason)
      return
    }

    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) return row

        if (field === 'grade') {
          return {
            ...row,
            grade: normalizeGradeInput(value),
          }
        }

        return {
          ...row,
          remarks: value,
        }
      })
    )
  }

  const applyAutomaticRemarks = () => {
    const blockedReason = getBlockedReason()
    if (blockedReason) {
      toast.warning(blockedReason)
      return
    }

    setRows((prev) =>
      prev.map((row) => {
        const error = getGradeError(row.grade)
        if (error !== null) return row

        return {
          ...row,
          remarks: getHonorLabel(Number(row.grade)),
        }
      })
    )

    toast.success('Remarks updated from grade values.')
  }

  const validateRows = () => {
    if (!rows.length) return 'No students found in this class.'

    const withEnteredGrades = rows.filter((row) => row.grade.trim() !== '')
    if (withEnteredGrades.length === 0) {
      return 'Please enter at least one grade.'
    }

    for (const row of rows) {
      const error = getGradeError(row.grade)
      if (error === 'Required') return `Please enter a grade for ${row.full_name}.`
      if (error === 'Invalid number') return `Invalid grade for ${row.full_name}.`
      if (error === 'Must be 0 to 100') {
        return `Grade for ${row.full_name} must be between 0 and 100.`
      }
    }

    return null
  }

  const buildGradesPayload = (): SubmitGradePayload[] => {
    return rows
      .filter((row) => row.grade.trim() !== '')
      .map((row) => ({
        student_id: row.student_id,
        class_id: selectedClassId,
        school_year: selectedSchoolYear,
        semester: selectedSemester,
        grading_period: selectedGradingPeriod,
        grade: Number(Number(row.grade).toFixed(2)),
        remarks: row.remarks.trim() || null,
        encoded_by: profileId,
      }))
  }

  const saveDraftOnly = async () => {
    if (!teacher || !profileId) {
      toast.error('Teacher account not loaded.')
      return
    }

    const blockedReason = getBlockedReason()
    if (blockedReason && blockedReason !== 'Grades are already submitted.') {
      toast.warning(blockedReason)
      return
    }

    const validationError = validateRows()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSavingDraft(true)
    toast.loading('Saving grades...', { id: 'save-draft' })

    try {
      const gradesPayload = buildGradesPayload()

      const { error } = await supabase.from('grades').upsert(gradesPayload, {
        onConflict: 'student_id,class_id,school_year,semester,grading_period',
      })

      if (error) {
        debugDbError('TeacherGradesPage saveDraft grades upsert failed', error, {
          payload: JSON.stringify(gradesPayload, null, 2),
        })
        toast.dismiss('save-draft')
        toast.error(getReadableError(error, 'Failed to save grades.'))
        return
      }

      toast.success('Draft grades saved.', { id: 'save-draft' })

      if (teacher.id && selectedSchoolYear && selectedClassId) {
        await loadSelectedClassData(
          teacher.id,
          selectedSchoolYear,
          selectedGradingPeriod,
          selectedClassId
        )
      }

      toast.info('Saved grades reloaded.')
    } catch (error) {
      debugDbError('TeacherGradesPage saveDraft unexpected error', error)
      toast.dismiss('save-draft')
      toast.error(getReadableError(error, 'Unexpected save error.'))
    } finally {
      setSavingDraft(false)
    }
  }

  const openPreviewModal = () => {
    if (!selectedClassId || !selectedSchoolYear) {
      toast.error('Please select a class first.')
      return
    }

    if (!selectedClass) {
      toast.error('Please select a valid class first.')
      return
    }

    if (!gradingWindow) {
      toast.error('No grading window found.')
      return
    }

    if (!gradingWindow.is_open) {
      toast.warning('Grading is closed.')
      return
    }

    if (gradingWindow.is_locked) {
      toast.warning('This grading period is locked.')
      return
    }

    if (gradeSubmission?.is_submitted && !inconsistentSubmittedState) {
      toast.warning('Grades are already submitted.')
      return
    }

    const validationError = validateRows()
    if (validationError) {
      toast.error(validationError)
      return
    }

    if (inconsistentSubmittedState) {
      toast.warning('Repair mode enabled. Review carefully before resubmitting.')
    } else {
      toast.success('Preview ready.')
    }

    setShowPreviewModal(true)
  }

  const handleFinalSubmit = async () => {
    if (!teacher || !profileId) {
      toast.error('Teacher account not loaded.')
      return
    }

    if (!selectedClassId || !selectedSchoolYear) {
      toast.error('Please select a class first.')
      return
    }

    if (!selectedClass) {
      toast.error('Selected class could not be loaded.')
      return
    }

    if (!gradingWindow) {
      toast.error('No grading window found.')
      return
    }

    if (!gradingWindow.is_open) {
      toast.error('Submission blocked. Grading is closed.')
      return
    }

    if (gradingWindow.is_locked) {
      toast.error('Submission blocked. This period is locked.')
      return
    }

    if (gradeSubmission?.is_submitted && !inconsistentSubmittedState) {
      toast.warning('Grades were already submitted.')
      setShowPreviewModal(false)
      return
    }

    const validationError = validateRows()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSubmitting(true)
    toast.loading('Submitting grades...', { id: 'submit-grades' })

    try {
      const gradesPayload = buildGradesPayload()

      const { error: gradesError } = await supabase.from('grades').upsert(gradesPayload, {
        onConflict: 'student_id,class_id,school_year,semester,grading_period',
      })

      if (gradesError) {
        debugDbError('TeacherGradesPage submit grades upsert failed', gradesError, {
          payload: JSON.stringify(gradesPayload, null, 2),
        })
        toast.dismiss('submit-grades')
        toast.error(getReadableError(gradesError, 'Failed to save grades.'))
        return
      }

      toast.success('Grades saved to database.', { id: 'submit-grades' })

      const { count: verifiedCount, error: verifyGradesError } = await supabase
        .from('grades')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', selectedClassId)
        .eq('school_year', selectedSchoolYear)
        .eq('semester', selectedSemester)
        .eq('grading_period', selectedGradingPeriod)

      if (verifyGradesError) {
        debugDbError('TeacherGradesPage verify grades failed', verifyGradesError, {
          selectedClassId,
          selectedSchoolYear,
          selectedSemester,
          selectedGradingPeriod,
        })
        toast.dismiss('submit-grades')
        toast.error(getReadableError(verifyGradesError, 'Failed to verify grades.'))
        return
      }

      if (!verifiedCount || verifiedCount === 0) {
        toast.dismiss('submit-grades')
        toast.error('No saved grades found after save.')
        return
      }

      toast.success(`Verified ${verifiedCount} saved grade row(s).`)

      const submissionPayload = {
        class_id: selectedClassId,
        teacher_id: teacher.id,
        school_year: selectedSchoolYear,
        term: selectedSemester,
        grading_period: selectedGradingPeriod,
        is_submitted: true,
        submitted_by: profileId,
        submitted_at: new Date().toISOString(),
      }

      const { error: submissionError } = await supabase
        .from('grade_submissions')
        .upsert(submissionPayload, {
          onConflict: 'class_id,school_year,term,grading_period',
        })

      if (submissionError) {
        debugDbError('TeacherGradesPage grade_submissions upsert failed', submissionError, {
          payload: JSON.stringify(submissionPayload, null, 2),
        })
        toast.dismiss('submit-grades')
        toast.error(getReadableError(submissionError, 'Failed to mark submission.'))
        return
      }

      toast.success('Submission record created.')

      const logPayload = {
        profile_id: profileId,
        action: 'submit_grades',
        entity_type: 'grades',
        entity_id: selectedClassId,
        details: {
          class_id: selectedClassId,
          school_year: selectedSchoolYear,
          semester: selectedSemester,
          grading_period: selectedGradingPeriod,
          total_students: rows.length,
          verified_rows: verifiedCount,
          subject: selectedClass.subjects?.subject_name ?? null,
          subject_code: selectedClass.subjects?.subject_code ?? null,
          section: selectedClass.section ?? null,
        },
      }

      const { error: logError } = await supabase.from('activity_logs').insert(logPayload)

      if (logError) {
        debugDbError('TeacherGradesPage activity_logs insert failed', logError, {
          payload: JSON.stringify(logPayload, null, 2),
        })
        toast.warning('Grades submitted, but activity log was not saved.')
      } else {
        toast.success('Activity log saved.')
      }

      toast.dismiss('submit-grades')
      toast.success('Grades submitted successfully.')
      setShowPreviewModal(false)

      await loadSelectedClassData(
        teacher.id,
        selectedSchoolYear,
        selectedGradingPeriod,
        selectedClassId
      )

      toast.info('Latest saved grades reloaded.')
    } catch (error) {
      debugDbError('TeacherGradesPage unexpected submit error', error)
      toast.dismiss('submit-grades')
      toast.error(getReadableError(error, 'Unexpected submit error.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-gray-500">Loading grade encoding...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 p-5 text-white shadow-xl sm:p-6"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-300">Teacher Grades</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Grade Encoding</h1>
              <p className="mt-2 max-w-2xl text-sm text-green-50/90">
                Encode, save, preview, and submit grades with fewer clicks and clearer status.
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
          <div className="grid gap-4 xl:grid-cols-[220px_220px_1fr]">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Academic Year
              </label>
              <select
                value={selectedSchoolYear}
                onChange={(e) => {
                  setSelectedSchoolYear(e.target.value)
                  toast.success('Academic year updated.')
                }}
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
                onChange={(e) => {
                  const value = e.target.value as GradingPeriod
                  setSelectedGradingPeriod(value)
                  queryStateRef.current.gradingPeriod = value
                  toast.success(`${value} period selected.`)
                }}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              >
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>
                    {period} Grading Period
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search Class
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Search subject code, name, grade, or section"
                  className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div
              className={`rounded-2xl border p-4 text-sm ${getStatusToneClasses(
                statusMessage.tone
              )}`}
            >
              <div className="flex items-start gap-3">
                {statusMessage.tone === 'danger' ? (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                ) : statusMessage.tone === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : statusMessage.tone === 'warning' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{statusMessage.title}</p>
                  <p className="mt-1">{statusMessage.description}</p>
                </div>
              </div>
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
              <h2 className="text-xl font-bold text-green-900">Your Classes</h2>
              <p className="text-sm text-gray-600">
                Pick a class once and start entering grades right away.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <Users className="h-4 w-4" />
              {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''}
            </div>
          </div>

          {filteredClasses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No classes found for this selection.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredClasses.map((item) => {
                const isSelected = item.id === selectedClassId

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClassSelect(item.id)}
                    className={`rounded-2xl border p-5 text-left transition ${
                      isSelected
                        ? 'border-green-300 bg-green-50'
                        : 'border-green-100 bg-white hover:border-green-200 hover:bg-green-50/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-green-900">
                        {item.subjects?.subject_name ?? 'Unnamed Subject'}
                      </h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                        {item.subjects?.subject_code ?? '—'}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                      <p>
                        Grade Level: <span className="font-medium">{item.grade_level}</span>
                      </p>
                      <p>
                        Section: <span className="font-medium">{item.section}</span>
                      </p>
                      <p>
                        Academic Year: <span className="font-medium">{item.school_year}</span>
                      </p>
                      <p>
                        Semester: <span className="font-medium">{item.semester}</span>
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-bold text-green-900">{selectedClassLabel}</h2>
              <p className="text-sm text-gray-600">
                {selectedClass
                  ? `${selectedClass.grade_level} • Section ${selectedClass.section} • ${selectedSemester}`
                  : 'Select a class to begin.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm">
                <p className="text-gray-500">Students</p>
                <p className="font-bold text-green-900">{previewSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-white px-4 py-3 text-sm">
                <p className="text-gray-500">Completed</p>
                <p className="font-bold text-green-900">{previewSummary.completed}</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-white px-4 py-3 text-sm">
                <p className="text-gray-500">Invalid</p>
                <p className="font-bold text-green-900">{previewSummary.invalid}</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-white px-4 py-3 text-sm">
                <p className="text-gray-500">Average</p>
                <p className="font-bold text-green-900">{previewSummary.average}</p>
              </div>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student number, name, gender, grade, or remarks"
                  className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyAutomaticRemarks}
                  disabled={!canEncodeGrades}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  Auto Remarks
                </button>

                <button
                  type="button"
                  onClick={saveDraftOnly}
                  disabled={savingDraft || submitting || !canEncodeGrades}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingDraft ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  onClick={openPreviewModal}
                  disabled={submitting || !canEncodeGrades}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  Review & Submit
                </button>
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No enrolled students found for this class.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-green-100">
              <table className="min-w-full">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                      Student No
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                      Student Name
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                      Gender
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                      Grade
                    </th>
                    <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                      Remarks
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row) => {
                    const gradeError = getGradeError(row.grade)
                    const hasGradeError = row.grade.trim() !== '' && gradeError !== null

                    return (
                      <tr key={row.student_id} className="border-t border-gray-100">
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {row.student_no || '—'}
                        </td>

                        <td className="px-4 py-4 text-sm font-medium text-green-950">
                          <div className="flex items-center gap-2">
                            <span>{row.full_name}</span>
                            {hasGradeError && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          {row.gender || '—'}
                        </td>

                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.grade}
                              disabled={!canEncodeGrades}
                              onChange={(e) =>
                                handleRowChange(row.student_id, 'grade', e.target.value)
                              }
                              onClick={() => {
                                const reason = getBlockedReason()
                                if (reason) toast.warning(reason)
                              }}
                              className={`w-28 rounded-xl border px-3 py-2 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 ${getInputToneClasses(
                                hasGradeError
                              )}`}
                              placeholder="0 - 100"
                            />
                            {hasGradeError && (
                              <p className="text-xs text-red-600">{gradeError}</p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <input
                            value={row.remarks}
                            disabled={!canEncodeGrades}
                            onChange={(e) =>
                              handleRowChange(row.student_id, 'remarks', e.target.value)
                            }
                            onClick={() => {
                              const reason = getBlockedReason()
                              if (reason) toast.warning(reason)
                            }}
                            className="w-full min-w-[180px] rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                            placeholder="Optional remarks"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Fast Flow</h3>
            </div>
            <p className="text-sm text-gray-600">
              Select class, encode grades, then submit. Draft save is available anytime.
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Safe Rules</h3>
            </div>
            <p className="text-sm text-gray-600">
              Editing is blocked only when grading is closed, locked, or already submitted.
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Clean Save Logic</h3>
            </div>
            <p className="text-sm text-gray-600">
              Grades are saved first, verified, then marked as submitted in grade submissions.
            </p>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="border-b border-gray-100 px-6 py-4">
                <p className="text-sm font-medium text-yellow-600">Submission Preview</p>
                <h2 className="text-2xl font-bold text-green-900">
                  Review Before Final Submit
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  These grades will be saved and then marked as submitted.
                </p>
              </div>

              <div className="px-6 py-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-sm text-gray-500">Total Students</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {previewSummary.total}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-4">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {previewSummary.completed}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-4">
                    <p className="text-sm text-gray-500">Average</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {previewSummary.average}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-4">
                    <p className="text-sm text-gray-500">Invalid Rows</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {previewSummary.invalid}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-gray-700">
                  <p>
                    <span className="font-semibold text-green-900">Class:</span>{' '}
                    {selectedClassLabel}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-green-900">Academic Year:</span>{' '}
                    {selectedSchoolYear}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-green-900">Semester:</span>{' '}
                    {selectedSemester}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-green-900">Grading Period:</span>{' '}
                    {selectedGradingPeriod}
                  </p>
                </div>

                <div className="mt-5 max-h-[420px] overflow-auto rounded-2xl border border-green-100">
                  <table className="min-w-full">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                          Student No
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                          Student Name
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                          Grade
                        </th>
                        <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.student_id} className="border-t border-gray-100">
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.student_no || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-green-950">
                            {row.full_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.grade}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  Grades will be saved first, then verified, then recorded as submitted.
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreviewModal(false)
                    toast.info('Preview closed.')
                  }}
                  disabled={submitting}
                  className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting || previewSummary.invalid > 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting ? 'Submitting...' : 'Confirm and Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}