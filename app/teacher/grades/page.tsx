'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileWarning,
  GraduationCap,
  Lock,
  Search,
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

function getGradeError(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return 'Required'

  const numericGrade = Number(trimmed)

  if (Number.isNaN(numericGrade)) return 'Invalid number'
  if (numericGrade < 0 || numericGrade > 100) return 'Must be 0 to 100'

  return null
}

export default function TeacherGradesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const classIdFromQuery = searchParams.get('classId') || ''

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] =
    useState<GradingPeriod>('1st')
  const [availablePeriods, setAvailablePeriods] =
    useState<GradingPeriod[]>(ALL_PERIODS)

  const [teacherClasses, setTeacherClasses] = useState<ClassRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState(classIdFromQuery)

  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null)
  const [gradingWindow, setGradingWindow] = useState<GradingWindowRow | null>(
    null
  )
  const [gradeSubmission, setGradeSubmission] =
    useState<GradeSubmissionRow | null>(null)

  const [rows, setRows] = useState<StudentGradeInput[]>([])
  const [search, setSearch] = useState('')

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const canEncodeGrades =
    gradingWindow?.is_open === true &&
    gradingWindow?.is_locked === false &&
    !gradeSubmission?.is_submitted

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) => {
      return (
        row.student_no.toLowerCase().includes(keyword) ||
        row.full_name.toLowerCase().includes(keyword) ||
        row.remarks.toLowerCase().includes(keyword) ||
        row.grade.toLowerCase().includes(keyword)
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
    ? `${selectedClass.subjects?.subject_code ?? '—'} - ${
        selectedClass.subjects?.subject_name ?? 'Unnamed Subject'
      }`
    : 'No class selected'

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
        'id, profile_id, teacher_no, first_name, middle_name, last_name, suffix, is_active'
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

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)

    if (yearRows.length > 0) {
      const active = yearRows.find((row) => row.is_active)
      setSelectedSchoolYear(
        (prev) => prev || active?.school_year || yearRows[0].school_year
      )
    }

    return yearRows
  }

  const loadWindowsAndCurrentPeriod = async (schoolYear: string) => {
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
      toast.error(error.message)
      setAvailablePeriods(ALL_PERIODS)
      setGradingWindow(null)
      return
    }

    const windowRows = (data ?? []) as GradingWindowRow[]

    const uniquePeriods = Array.from(
      new Set(windowRows.map((row) => row.grading_period as GradingPeriod))
    ).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b))

    setAvailablePeriods(uniquePeriods.length > 0 ? uniquePeriods : ALL_PERIODS)

    const openWindow =
      windowRows
        .filter((row) => row.is_open && !row.is_locked)
        .sort(
          (a, b) =>
            getPeriodSortValue(a.grading_period) -
            getPeriodSortValue(b.grading_period)
        )[0] ?? null

    const fallbackWindow =
      windowRows.sort(
        (a, b) =>
          getPeriodSortValue(a.grading_period) -
          getPeriodSortValue(b.grading_period)
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

  const loadSpecificWindow = async (
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
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

  const loadTeacherClasses = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear) {
      setTeacherClasses([])
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
      toast.error(error.message)
      setTeacherClasses([])
      return
    }

    const classRows = (data ?? []) as ClassRow[]
    setTeacherClasses(classRows)

    if (!selectedClassId && classRows.length > 0) {
      setSelectedClassId(classRows[0].id)
    }

    if (selectedClassId && !classRows.some((item) => item.id === selectedClassId)) {
      setSelectedClassId(classRows[0]?.id ?? '')
    }
  }

  const loadSelectedClassData = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod,
    classId: string
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear || !classId) {
      setSelectedClass(null)
      setRows([])
      setGradeSubmission(null)
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
      toast.error('Class not found or not assigned to your account.')
      setSelectedClass(null)
      setRows([])
      setGradeSubmission(null)
      return
    }

    setSelectedClass(classData as ClassRow)

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
            suffix
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
      toast.error(enrollmentsResult.error.message)
      setRows([])
      return
    }

    if (gradesResult.error) {
      toast.error(gradesResult.error.message)
      setRows([])
      return
    }

    if (submissionResult.error) {
      toast.error(submissionResult.error.message)
      setRows([])
      return
    }

    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentQueryRow[]
    const grades = (gradesResult.data ?? []) as GradeRow[]

    setGradeSubmission((submissionResult.data as GradeSubmissionRow | null) ?? null)

    const gradeMap = new Map<string, GradeRow>()
    grades.forEach((item) => {
      gradeMap.set(item.student_id, item)
    })

    const builtRows: StudentGradeInput[] = enrollments
      .filter((item) => item.students)
      .map((item) => {
        const student = item.students as StudentRow
        const existingGrade = gradeMap.get(student.id)

        return {
          student_id: student.id,
          student_no: student.student_no ?? '',
          full_name: formatFullName(student),
          grade:
            existingGrade?.grade !== undefined && existingGrade?.grade !== null
              ? String(existingGrade.grade)
              : '',
          remarks: existingGrade?.remarks ?? '',
        }
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))

    setRows(builtRows)
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const teacherRow = await loadGuard()
      if (!teacherRow) {
        setLoading(false)
        return
      }

      const years = await loadAcademicYears()
      const activeYear =
        years.find((row) => row.is_active)?.school_year || years[0]?.school_year

      if (activeYear) {
        await loadWindowsAndCurrentPeriod(activeYear)
      }

      setLoading(false)
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!selectedSchoolYear) return
    loadWindowsAndCurrentPeriod(selectedSchoolYear)
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
    if (!teacher?.id || !selectedSchoolYear || !selectedClassId) return
    loadSelectedClassData(
      teacher.id,
      selectedSchoolYear,
      selectedGradingPeriod,
      selectedClassId
    )
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod, selectedClassId])

  const handleRowChange = (
    studentId: string,
    field: 'grade' | 'remarks',
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) return row

        if (field === 'grade') {
          let next = value.replace(/[^\d.]/g, '')

          const parts = next.split('.')

          if (parts.length > 2) {
            next = `${parts[0]}.${parts.slice(1).join('')}`
          }

          const normalizedParts = next.split('.')
          if (normalizedParts[1]?.length > 2) {
            next = `${normalizedParts[0]}.${normalizedParts[1].slice(0, 2)}`
          }

          return {
            ...row,
            grade: next,
          }
        }

        return {
          ...row,
          remarks: value,
        }
      })
    )
  }

  const validateRows = () => {
    if (!rows.length) return 'No students found in this class.'

    for (const row of rows) {
      const error = getGradeError(row.grade)
      if (error === 'Required') {
        return `Please enter a grade for ${row.full_name}.`
      }
      if (error === 'Invalid number') {
        return `Invalid numeric grade for ${row.full_name}.`
      }
      if (error === 'Must be 0 to 100') {
        return `Grade for ${row.full_name} must be between 0 and 100.`
      }
    }

    return null
  }

  const openPreviewModal = () => {
    if (!selectedClassId || !selectedSchoolYear) {
      toast.error('Please select a class first.')
      return
    }

    if (!gradingWindow) {
      toast.error('No grading window found for this period.')
      return
    }

    if (!canEncodeGrades) {
      toast.error('Grade submission is not available for this grading period.')
      return
    }

    const validationError = validateRows()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setShowPreviewModal(true)
  }

  const handleFinalSubmit = async () => {
    if (!teacher) {
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
      toast.error('No grading window found for this period.')
      return
    }

    if (!canEncodeGrades) {
      toast.error('Submission is not available for this grading period.')
      return
    }

    const validationError = validateRows()
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSubmitting(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        toast.error('Session expired. Please log in again.')
        router.replace('/login')
        return
      }

      const gradesPayload: SubmitGradePayload[] = rows.map((row) => ({
        student_id: row.student_id,
        class_id: selectedClassId,
        school_year: selectedSchoolYear,
        semester: selectedSemester,
        grading_period: selectedGradingPeriod,
        grade: Number(Number(row.grade).toFixed(2)),
        remarks: row.remarks.trim() || null,
        encoded_by: user.id,
      }))

      const invalidPayload = gradesPayload.find(
        (item) => Number.isNaN(item.grade) || item.grade < 0 || item.grade > 100
      )

      if (invalidPayload) {
        toast.error('One or more grades are invalid.')
        return
      }

      const { data: savedGrades, error: gradesError } = await supabase
        .from('grades')
        .upsert(gradesPayload, {
          onConflict: 'student_id,class_id,school_year,semester,grading_period',
          ignoreDuplicates: false,
        })
        .select('id, student_id')

      if (gradesError) {
        console.error('[TeacherGradesPage] grades upsert error:', gradesError)
        toast.error(`Grades save failed: ${gradesError.message}`)
        return
      }

      const submissionPayload = {
        class_id: selectedClassId,
        teacher_id: teacher.id,
        school_year: selectedSchoolYear,
        term: selectedSemester,
        grading_period: selectedGradingPeriod,
        is_submitted: true,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      }

      const { error: submissionError } = await supabase
        .from('grade_submissions')
        .upsert(submissionPayload, {
          onConflict: 'class_id,school_year,term,grading_period',
        })
        .select('id')

      if (submissionError) {
        console.error(
          '[TeacherGradesPage] grade_submissions upsert error:',
          submissionError
        )
        toast.error(`Submission record failed: ${submissionError.message}`)
        return
      }

      const logPayload = {
        profile_id: user.id,
        action: 'submit_grades',
        entity_type: 'grades',
        entity_id: selectedClassId,
        details: {
          class_id: selectedClassId,
          school_year: selectedSchoolYear,
          semester: selectedSemester,
          grading_period: selectedGradingPeriod,
          total_students: rows.length,
          saved_rows: savedGrades?.length ?? 0,
          subject: selectedClass.subjects?.subject_name ?? null,
          subject_code: selectedClass.subjects?.subject_code ?? null,
          section: selectedClass.section ?? null,
        },
      }

      const { error: logError } = await supabase
        .from('activity_logs')
        .insert(logPayload)

      if (logError) {
        console.error('[TeacherGradesPage] activity_logs insert error:', logError)
      }

      toast.success('Grades submitted successfully.')
      setShowPreviewModal(false)

      await loadSelectedClassData(
        teacher.id,
        selectedSchoolYear,
        selectedGradingPeriod,
        selectedClassId
      )
    } catch (error) {
      console.error('[TeacherGradesPage] Unexpected submit error:', error)
      toast.error('Unexpected error while submitting grades.')
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
          className="rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 p-5 text-white shadow-xl sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-300">Teacher Grades</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Grade Encoding</h1>
              <p className="mt-2 max-w-2xl text-sm text-green-50/90">
                Encode and submit grades for your assigned classes during the active
                grading period.
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
          <div className="grid gap-4 xl:grid-cols-[1fr_220px_1fr]">
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
                onChange={(e) =>
                  setSelectedGradingPeriod(e.target.value as GradingPeriod)
                }
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
                Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              >
                <option value="">Select class</option>
                {teacherClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subjects?.subject_code ?? '—'} -{' '}
                    {item.subjects?.subject_name ?? 'Unnamed Subject'} •{' '}
                    {item.grade_level} • {item.section}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                gradingWindow?.is_open
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {gradingWindow?.is_open ? 'Grading Open' : 'Grading Closed'}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                gradingWindow?.is_locked
                  ? 'bg-red-100 text-red-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {gradingWindow?.is_locked ? 'Locked' : 'Unlocked'}
            </span>

            {gradeSubmission?.is_submitted && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Submitted
              </span>
            )}
          </div>

          {!gradingWindow && (
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
              No grading window is configured for this academic year and grading
              period.
            </div>
          )}

          {gradingWindow && !gradingWindow.is_open && (
            <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
              Grading is currently closed for this period.
            </div>
          )}

          {gradingWindow?.is_locked && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              This grading period is locked. Editing is disabled.
            </div>
          )}

          {gradeSubmission?.is_submitted && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Grades for this class and grading period have already been submitted.
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-green-900">{selectedClassLabel}</h2>
              <p className="text-sm text-gray-600">
                {selectedClass
                  ? `${selectedClass.grade_level} • Section ${selectedClass.section} • ${selectedSemester}`
                  : 'Select a class to begin encoding.'}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              <Users className="h-4 w-4" />
              {rows.length} student{rows.length !== 1 ? 's' : ''}
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mt-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student number, name, grade, or remarks"
                  className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No enrolled students found for this class.
            </div>
          ) : (
            <>
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
                                className={`w-28 rounded-xl border px-3 py-2 outline-none transition focus:ring-2 disabled:bg-gray-100 ${
                                  hasGradeError
                                    ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-700 focus:ring-green-200'
                                }`}
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
                              className="w-full min-w-[180px] rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:bg-gray-100"
                              placeholder="Optional remarks"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={openPreviewModal}
                  disabled={submitting || !canEncodeGrades}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Eye className="h-4 w-4" />
                  Preview and Submit Grades
                </button>
              </div>
            </>
          )}
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Submission Flow</h3>
            </div>
            <p className="text-sm text-gray-600">
              Grades will only be written to the database after you confirm them in
              the preview.
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Restrictions</h3>
            </div>
            <p className="text-sm text-gray-600">
              Editing is blocked when the grading period is closed, locked, or already
              submitted.
            </p>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-green-800" />
              <h3 className="font-bold text-green-900">Logs</h3>
            </div>
            <p className="text-sm text-gray-600">
              Every final submission is recorded as an activity log for tracking and
              audit.
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
                  Review Grades Before Final Submission
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  These grades will be inserted or updated in the database after
                  confirmation.
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
                    <p className="text-sm text-gray-500">Completed Grades</p>
                    <p className="mt-1 text-2xl font-bold text-green-900">
                      {previewSummary.completed}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-100 bg-white p-4">
                    <p className="text-sm text-gray-500">Average Grade</p>
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
                    <span className="font-semibold text-green-900">
                      Academic Year:
                    </span>{' '}
                    {selectedSchoolYear}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-green-900">Semester:</span>{' '}
                    {selectedSemester}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-green-900">
                      Grading Period:
                    </span>{' '}
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
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.grade}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {row.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  After confirmation, these grades will be saved to the database and
                  marked as submitted for this class and grading period.
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
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