'use client'

import Image from 'next/image'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'
type ReportType = 'class_list_only' | 'class_list_with_grades' | 'attendance_sheet'

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

type RawClassRow = Omit<ClassRow, 'subjects'> & {
  subjects: SubjectRow[] | SubjectRow | null
}

type StudentRow = {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  gender?: 'Male' | 'Female' | null
  grade_level?: string | null
  section?: string | null
}

type EnrollmentQueryRow = {
  student_id: string
  students: StudentRow | null
}

type RawEnrollmentQueryRow = {
  student_id: string
  students: StudentRow[] | StudentRow | null
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

type ReportRow = {
  student_id: string
  full_name: string
  gender: string
  grade_and_section: string
  grade: string
  remarks: string
  last_name_sort: string
  first_name_sort: string
}

type ClassCardMeta = {
  studentCount: number
  encodedCount: number
}

const ALL_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']
const ATTENDANCE_COLUMN_COUNT = 10

function getSemesterFromPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function getPeriodSortValue(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

function getMiddleInitial(name?: string | null) {
  if (!name?.trim()) return ''
  return `${name.trim().charAt(0).toUpperCase()}.`
}

function getFullName(
  lastName?: string | null,
  firstName?: string | null,
  middleName?: string | null,
  suffix?: string | null
) {
  const mi = getMiddleInitial(middleName)
  const base = `${lastName ?? ''}, ${firstName ?? ''}${mi ? ` ${mi}` : ''}`.trim()
  return suffix?.trim() ? `${base} ${suffix.trim()}` : base
}

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Teacher'
  return [teacher.first_name, teacher.middle_name, teacher.last_name, teacher.suffix]
    .filter(Boolean)
    .join(' ')
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

function getReportTitle(reportType: ReportType) {
  if (reportType === 'class_list_only') return 'Official Class List'
  if (reportType === 'class_list_with_grades') return 'Official Class List with Grades'
  return 'Official Attendance Sheet'
}

function getReportToast(reportType: ReportType) {
  if (reportType === 'class_list_only') return 'Class list loaded.'
  if (reportType === 'class_list_with_grades') return 'Class list with grades loaded.'
  return 'Attendance sheet loaded.'
}

function getGenderSortValue(gender: string) {
  if (gender === 'Male') return 0
  if (gender === 'Female') return 1
  return 2
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
  }
}

function normalizeEnrollmentRow(row: RawEnrollmentQueryRow): EnrollmentQueryRow {
  return {
    student_id: row.student_id,
    students: getSingleRelation(row.students),
  }
}

function StatCard({
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
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-green-950">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}

function TeacherReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const printRef = useRef<HTMLDivElement | null>(null)

  const classIdFromQuery = searchParams.get('classId') || ''

  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState<GradingPeriod>('1st')
  const [availablePeriods, setAvailablePeriods] = useState<GradingPeriod[]>(ALL_PERIODS)

  const [teacherClasses, setTeacherClasses] = useState<ClassRow[]>([])
  const [classMetaMap, setClassMetaMap] = useState<Record<string, ClassCardMeta>>({})
  const [selectedClassId, setSelectedClassId] = useState(classIdFromQuery)
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null)

  const [rows, setRows] = useState<ReportRow[]>([])
  const [classSearch, setClassSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('class_list_only')

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const attendanceHeaders = useMemo(
    () => Array.from({ length: ATTENDANCE_COLUMN_COUNT }, (_, index) => `attendance-${index + 1}`),
    []
  )

  const filteredClasses = useMemo(() => {
    const keyword = classSearch.trim().toLowerCase()
    if (!keyword) return teacherClasses

    return teacherClasses.filter((item) => {
      const subjectName = item.subjects?.subject_name?.toLowerCase() ?? ''
      const subjectCode = item.subjects?.subject_code?.toLowerCase() ?? ''
      const gradeLevel = item.grade_level.toLowerCase()
      const section = item.section.toLowerCase()

      return (
        subjectName.includes(keyword) ||
        subjectCode.includes(keyword) ||
        gradeLevel.includes(keyword) ||
        section.includes(keyword)
      )
    })
  }, [teacherClasses, classSearch])

  const filteredRows = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase()
    if (!keyword) return rows

    return rows.filter((row) => {
      return (
        row.full_name.toLowerCase().includes(keyword) ||
        row.gender.toLowerCase().includes(keyword) ||
        row.grade_and_section.toLowerCase().includes(keyword) ||
        row.grade.toLowerCase().includes(keyword) ||
        row.remarks.toLowerCase().includes(keyword)
      )
    })
  }, [rows, studentSearch])

  const averageGrade = useMemo(() => {
    const numericGrades = rows
      .map((row) => Number(row.grade))
      .filter((value) => !Number.isNaN(value))

    if (numericGrades.length === 0) return '—'

    const avg = numericGrades.reduce((sum, value) => sum + value, 0) / numericGrades.length
    return avg.toFixed(2)
  }, [rows])

  const reportStats = useMemo(() => {
    const totalStudents = filteredRows.length
    const encodedGrades = filteredRows.filter((row) => row.grade.trim() !== '').length
    const maleCount = filteredRows.filter((row) => row.gender === 'Male').length
    const femaleCount = filteredRows.filter((row) => row.gender === 'Female').length

    return {
      totalStudents,
      encodedGrades,
      maleCount,
      femaleCount,
    }
  }, [filteredRows])

  const overallStats = useMemo(() => {
    const totalClasses = filteredClasses.length
    const totalStudents = filteredClasses.reduce(
      (sum, item) => sum + (classMetaMap[item.id]?.studentCount ?? 0),
      0
    )
    const totalEncoded = filteredClasses.reduce(
      (sum, item) => sum + (classMetaMap[item.id]?.encodedCount ?? 0),
      0
    )

    return {
      totalClasses,
      totalStudents,
      totalEncoded,
    }
  }, [filteredClasses, classMetaMap])

  const selectedClassLabel = selectedClass
    ? `${selectedClass.subjects?.subject_code ?? '—'} - ${selectedClass.subjects?.subject_name ?? 'Unnamed Subject'}`
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
      router.replace('/change-password')
      return null
    }

    if (profileRow.role !== 'teacher') {
      router.replace('/login')
      return null
    }

    const { data: teacherData, error: teacherError } = await supabase
      .from('teachers')
      .select('id, profile_id, teacher_no, first_name, middle_name, last_name, suffix, is_active')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (teacherError || !teacherData) {
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
      toast.error(error.message)
      setAcademicYears([])
      return []
    }

    const yearRows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(yearRows)

    if (yearRows.length > 0) {
      const active = yearRows.find((row) => row.is_active)
      setSelectedSchoolYear((prev) => prev || active?.school_year || yearRows[0].school_year)
    }

    return yearRows
  }

  const loadWindowsAndCurrentPeriod = async (schoolYear: string) => {
    if (!schoolYear) {
      setAvailablePeriods(ALL_PERIODS)
      return
    }

    const { data, error } = await supabase
      .from('grading_windows')
      .select('id, school_year, semester, grading_period, is_open, is_locked')
      .eq('school_year', schoolYear)

    if (error) {
      toast.error(error.message)
      setAvailablePeriods(ALL_PERIODS)
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
          (a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
        )[0] ?? null

    const fallbackWindow =
      [...windowRows].sort(
        (a, b) => getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
      )[0] ?? null

    const chosenWindow = openWindow ?? fallbackWindow
    setSelectedGradingPeriod(chosenWindow?.grading_period ?? '1st')
  }

  const loadTeacherClasses = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear) {
      setTeacherClasses([])
      setClassMetaMap({})
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
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true })

    if (error) {
      toast.error(error.message)
      setTeacherClasses([])
      setClassMetaMap({})
      return
    }

    const classRows = ((data ?? []) as RawClassRow[]).map(normalizeClassRow)
    setTeacherClasses(classRows)

    if (classRows.length === 0) {
      setClassMetaMap({})
      setSelectedClassId('')
      return
    }

    const classIds = classRows.map((item) => item.id)

    const [enrollmentsResult, gradesResult] = await Promise.all([
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
    ])

    if (enrollmentsResult.error) {
      toast.error(enrollmentsResult.error.message)
      setClassMetaMap({})
      return
    }

    if (gradesResult.error) {
      toast.error(gradesResult.error.message)
      setClassMetaMap({})
      return
    }

    const enrollmentMap = new Map<string, Set<string>>()
    const gradeMap = new Map<string, Set<string>>()

    for (const row of enrollmentsResult.data ?? []) {
      const typed = row as { class_id: string; student_id: string }
      if (!enrollmentMap.has(typed.class_id)) enrollmentMap.set(typed.class_id, new Set())
      enrollmentMap.get(typed.class_id)!.add(typed.student_id)
    }

    for (const row of gradesResult.data ?? []) {
      const typed = row as { class_id: string; student_id: string }
      if (!gradeMap.has(typed.class_id)) gradeMap.set(typed.class_id, new Set())
      gradeMap.get(typed.class_id)!.add(typed.student_id)
    }

    const nextMeta: Record<string, ClassCardMeta> = {}
    classRows.forEach((item) => {
      nextMeta[item.id] = {
        studentCount: (enrollmentMap.get(item.id) ?? new Set()).size,
        encodedCount: (gradeMap.get(item.id) ?? new Set()).size,
      }
    })
    setClassMetaMap(nextMeta)

    if (!selectedClassId && classRows.length > 0) {
      setSelectedClassId(classRows[0].id)
    }

    if (selectedClassId && !classRows.some((item) => item.id === selectedClassId)) {
      setSelectedClassId(classRows[0]?.id ?? '')
    }
  }

  const loadReportData = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod,
    classId: string,
    reportType?: ReportType
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear || !classId) {
      setSelectedClass(null)
      setRows([])
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
      toast.error('Class not found.')
      setSelectedClass(null)
      setRows([])
      return
    }

    const normalizedClass = normalizeClassRow(classData as RawClassRow)
    setSelectedClass(normalizedClass)

    const [enrollmentsResult, gradesResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select(`
          student_id,
          students:student_id (
            id,
            first_name,
            middle_name,
            last_name,
            suffix,
            gender,
            grade_level,
            section
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

    const enrollments = ((enrollmentsResult.data ?? []) as RawEnrollmentQueryRow[]).map(
      normalizeEnrollmentRow
    )
    const grades = (gradesResult.data ?? []) as GradeRow[]

    const gradeMap = new Map<string, GradeRow>()
    grades.forEach((item) => {
      gradeMap.set(item.student_id, item)
    })

    const builtRows: ReportRow[] = enrollments
      .filter((item) => item.students)
      .map((item) => {
        const student = item.students as StudentRow
        const gradeRow = gradeMap.get(student.id)

        const numericGrade =
          gradeRow?.grade !== undefined && gradeRow?.grade !== null
            ? Number(gradeRow.grade)
            : null

        return {
          student_id: student.id,
          full_name: getFullName(
            student.last_name,
            student.first_name,
            student.middle_name,
            student.suffix
          ),
          gender: student.gender ?? '—',
          grade_and_section: `${student.grade_level ?? normalizedClass.grade_level ?? ''} - ${student.section ?? normalizedClass.section ?? ''}`.trim(),
          grade: numericGrade !== null ? String(numericGrade) : '',
          remarks: gradeRow?.remarks?.trim() || getHonorLabel(numericGrade),
          last_name_sort: (student.last_name ?? '').trim().toLowerCase(),
          first_name_sort: (student.first_name ?? '').trim().toLowerCase(),
        }
      })
      .sort((a, b) => {
        const genderCompare = getGenderSortValue(a.gender) - getGenderSortValue(b.gender)
        if (genderCompare !== 0) return genderCompare

        const lastNameCompare = a.last_name_sort.localeCompare(b.last_name_sort)
        if (lastNameCompare !== 0) return lastNameCompare

        return a.first_name_sort.localeCompare(b.first_name_sort)
      })

    setRows(builtRows)

    if (builtRows.length === 0) {
      toast.warning('No students found.')
    } else if (reportType) {
      toast.success(getReportToast(reportType))
    }
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const teacherRow = await loadGuard()
      if (!teacherRow) return

      const years = await loadAcademicYears()
      const activeYear = years.find((row) => row.is_active)?.school_year || years[0]?.school_year

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
    if (!teacher?.id || !selectedSchoolYear) return
    loadTeacherClasses(teacher.id, selectedSchoolYear, selectedGradingPeriod)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear || !selectedClassId) return
    loadReportData(teacher.id, selectedSchoolYear, selectedGradingPeriod, selectedClassId)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod, selectedClassId])

  const openPreview = async (classId: string) => {
    setSelectedClassId(classId)
    setPreviewOpen(true)
    setStudentSearch('')

    if (!teacher?.id || !selectedSchoolYear) return

    await loadReportData(
      teacher.id,
      selectedSchoolYear,
      selectedGradingPeriod,
      classId,
      selectedReportType
    )
  }

  const handlePrint = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 250)
  }

  const handleQuickDownload = async (classId: string) => {
    await openPreview(classId)
    toast.success('Preparing print-friendly report...')
    setTimeout(() => {
      window.print()
    }, 350)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-gray-500">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          header,
          aside,
          .no-print {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-only-area {
            display: block !important;
          }

          .print-container {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }

          .print-page {
            padding: 0 !important;
          }

          .page-break-inside-avoid {
            break-inside: avoid;
          }

          .attendance-name {
            font-size: 11px !important;
          }
        }
      `}</style>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print overflow-hidden rounded-[28px] bg-gradient-to-r from-green-950 via-green-900 to-green-800 p-6 text-white shadow-xl"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-green-50 ring-1 ring-white/10">
              <FileText className="h-3.5 w-3.5" />
              Teacher Reports
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Better reports, faster workflow
            </h1>
            <p className="mt-3 text-sm leading-6 text-green-50/90 sm:text-base">
              Choose a class, open a clean report preview in a modal, then print or save as PDF without leaving the page.
            </p>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!selectedClass}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-green-900 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            {printing ? 'Preparing...' : 'Print Current Report'}
          </button>
        </div>
      </motion.section>

      <section className="no-print grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Classes"
          value={overallStats.totalClasses}
          subtitle="Filtered classes ready for reports"
        />
        <StatCard
          title="Students"
          value={overallStats.totalStudents}
          subtitle="Combined students in shown classes"
        />
        <StatCard
          title="Encoded Grades"
          value={overallStats.totalEncoded}
          subtitle="Existing grade records for this period"
        />
        <StatCard
          title="Selected Period"
          value={`${selectedGradingPeriod}`}
          subtitle={`${selectedSemester} of ${selectedSchoolYear || '—'}`}
        />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 xl:grid-cols-4">
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Default Report Type</label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="class_list_only">Class List Only</option>
              <option value="class_list_with_grades">Class List with Grades</option>
              <option value="attendance_sheet">Attendance Sheet</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Search Class</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                placeholder="Search subject, code, grade, or section"
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              />
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-green-900">Classes ready for reporting</h2>
            <p className="text-sm text-gray-600">
              Open a clean preview modal or quickly print a report for any class.
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
              const meta = classMetaMap[item.id] ?? { studentCount: 0, encodedCount: 0 }

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-5 shadow-sm transition ${
                    isSelected
                      ? 'border-green-300 bg-green-50/70'
                      : 'border-green-100 bg-white hover:border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-green-950">
                        {item.subjects?.subject_name ?? 'Unnamed Subject'}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          {item.subjects?.subject_code ?? '—'}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          {item.grade_level}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                          Section {item.section}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-green-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Students</p>
                      <p className="mt-1 text-2xl font-bold text-green-950">{meta.studentCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-green-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Encoded</p>
                      <p className="mt-1 text-2xl font-bold text-green-950">{meta.encodedCount}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => openPreview(item.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-700 bg-white px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50"
                    >
                      <Eye className="h-4 w-4" />
                      Open Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDownload(item.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
                    >
                      <Download className="h-4 w-4" />
                      Print / Save PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.section>

      <div className="print-only-area hidden">
        <div className="print-container rounded-3xl border border-green-100 bg-white shadow-sm">
          <div ref={printRef} className="print-page p-6 sm:p-8">
            <div className="page-break-inside-avoid">
              <div className="flex items-start justify-between gap-4">
                <div className="flex w-20 items-start justify-start">
                  <Image
                    src="/DePed-logo.png"
                    alt="DepEd Logo"
                    width={72}
                    height={72}
                    className="h-[68px] w-[68px] object-contain"
                    priority
                  />
                </div>

                <div className="flex-1 text-center">
                  <p className="text-sm text-gray-700">Republic of the Philippines</p>
                  <p className="text-lg font-bold text-gray-900">Department of Education</p>
                  <p className="mt-1 text-2xl font-bold tracking-wide text-green-900">
                    Qorban Institute of Technology Training and Assessment Center, Inc
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-700">
                    {getReportTitle(selectedReportType)}
                  </p>
                </div>

                <div className="flex w-20 items-start justify-end">
                  <Image
                    src="/logo.jpg"
                    alt="Qorban Logo"
                    width={72}
                    height={72}
                    className="h-[68px] w-[68px] object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-x-8 gap-y-2 border-y border-gray-300 py-4 text-sm text-gray-800 sm:grid-cols-2">
                <p>
                  <span className="font-semibold">Teacher:</span> {getTeacherName(teacher)}
                </p>
                <p>
                  <span className="font-semibold">Teacher No:</span> {teacher?.teacher_no ?? '—'}
                </p>
                <p>
                  <span className="font-semibold">Academic Year:</span> {selectedSchoolYear || '—'}
                </p>
                <p>
                  <span className="font-semibold">Period:</span> {selectedGradingPeriod} Grading Period
                </p>
                <p>
                  <span className="font-semibold">Subject:</span> {selectedClassLabel}
                </p>
                <p>
                  <span className="font-semibold">Grade / Section:</span>{' '}
                  {selectedClass ? `${selectedClass.grade_level} / ${selectedClass.section}` : '—'}
                </p>
                <p>
                  <span className="font-semibold">Semester:</span> {selectedSemester}
                </p>
                <p>
                  <span className="font-semibold">Report Type:</span> {getReportTitle(selectedReportType)}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-2 font-medium text-green-800">
                  <Users className="h-4 w-4" />
                  {filteredRows.length} student{filteredRows.length !== 1 ? 's' : ''}
                </div>

                {selectedReportType === 'class_list_with_grades' && (
                  <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-2 font-medium text-green-800">
                    <FileText className="h-4 w-4" />
                    Average Grade: {averageGrade}
                  </div>
                )}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                No report data found for this selection.
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-300">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[52px]" />
                    <col className={selectedReportType === 'attendance_sheet' ? 'w-[34%]' : 'w-[40%]'} />
                    <col className={selectedReportType === 'attendance_sheet' ? 'w-[16%]' : 'w-[20%]'} />

                    {(selectedReportType === 'class_list_only' ||
                      selectedReportType === 'class_list_with_grades') && <col className="w-[12%]" />}

                    {selectedReportType === 'class_list_with_grades' && (
                      <>
                        <col className="w-[10%]" />
                        <col className="w-[18%]" />
                      </>
                    )}

                    {selectedReportType === 'attendance_sheet' &&
                      attendanceHeaders.map((label) => <col key={label} className="w-[5%]" />)}
                  </colgroup>

                  <thead className="bg-green-50">
                    <tr>
                      <th className="border border-gray-300 px-2 py-3 text-center text-sm font-semibold text-green-900">No.</th>
                      <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Full Name</th>
                      <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Grade & Section</th>

                      {(selectedReportType === 'class_list_only' ||
                        selectedReportType === 'class_list_with_grades') && (
                        <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Gender</th>
                      )}

                      {selectedReportType === 'class_list_with_grades' && (
                        <>
                          <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Grade</th>
                          <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Remarks</th>
                        </>
                      )}

                      {selectedReportType === 'attendance_sheet' &&
                        attendanceHeaders.map((label) => (
                          <th
                            key={label}
                            className="border border-gray-300 px-1 py-4 text-center text-sm font-semibold text-green-900"
                          >
                            &nbsp;
                          </th>
                        ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={row.student_id}>
                        <td className="border border-gray-300 px-2 py-3 text-center text-sm text-gray-700 align-middle">
                          {index + 1}
                        </td>

                        <td
                          className={`border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle break-words ${
                            selectedReportType === 'attendance_sheet' ? 'attendance-name' : ''
                          }`}
                        >
                          {row.full_name}
                        </td>

                        <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle">
                          {row.grade_and_section || '—'}
                        </td>

                        {(selectedReportType === 'class_list_only' ||
                          selectedReportType === 'class_list_with_grades') && (
                          <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle">
                            {row.gender || '—'}
                          </td>
                        )}

                        {selectedReportType === 'class_list_with_grades' && (
                          <>
                            <td className="border border-gray-300 px-3 py-3 text-sm font-medium text-gray-900 align-middle">
                              {row.grade || '—'}
                            </td>
                            <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle break-words">
                              {row.remarks || '—'}
                            </td>
                          </>
                        )}

                        {selectedReportType === 'attendance_sheet' &&
                          attendanceHeaders.map((label) => (
                            <td
                              key={`${row.student_id}-${label}`}
                              className="h-12 border border-gray-300 px-1 py-3 align-middle"
                            >
                              &nbsp;
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-12 grid gap-10 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Prepared by:</p>
                <div className="mt-12 border-t border-gray-500 pt-2">
                  <p className="text-sm font-semibold text-gray-900">{getTeacherName(teacher)}</p>
                  <p className="text-xs text-gray-600">Subject Teacher</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600">Date Generated:</p>
                <div className="mt-12 border-t border-gray-500 pt-2">
                  <p className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-600">System Generated Report</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="no-print fixed inset-0 z-50 bg-black/50 p-3 sm:p-6"
          >
            <div className="flex h-full items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
              >
                <div className="flex flex-col gap-4 border-b border-green-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-green-950">Report Preview</h2>
                    <p className="mt-1 truncate text-sm text-gray-500">{selectedClassLabel}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-2 rounded-xl border border-green-700 bg-white px-4 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-50"
                    >
                      <Printer className="h-4 w-4" />
                      Print / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(false)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 border-b border-green-100 px-5 py-4 xl:grid-cols-[220px_260px_1fr]">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Report Type</label>
                    <select
                      value={selectedReportType}
                      onChange={async (e) => {
                        const nextType = e.target.value as ReportType
                        setSelectedReportType(nextType)

                        if (teacher?.id && selectedSchoolYear && selectedClassId) {
                          await loadReportData(
                            teacher.id,
                            selectedSchoolYear,
                            selectedGradingPeriod,
                            selectedClassId,
                            nextType
                          )
                        }
                      }}
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    >
                      <option value="class_list_only">Class List Only</option>
                      <option value="class_list_with_grades">Class List with Grades</option>
                      <option value="attendance_sheet">Attendance Sheet</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Search Student</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student in preview"
                        className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-green-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Students</p>
                      <p className="mt-1 text-xl font-bold text-green-950">{reportStats.totalStudents}</p>
                    </div>
                    <div className="rounded-2xl bg-green-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Male</p>
                      <p className="mt-1 text-xl font-bold text-green-950">{reportStats.maleCount}</p>
                    </div>
                    <div className="rounded-2xl bg-green-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Female</p>
                      <p className="mt-1 text-xl font-bold text-green-950">{reportStats.femaleCount}</p>
                    </div>
                    <div className="rounded-2xl bg-green-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {selectedReportType === 'class_list_with_grades' ? 'Average' : 'Encoded'}
                      </p>
                      <p className="mt-1 text-xl font-bold text-green-950">
                        {selectedReportType === 'class_list_with_grades' ? averageGrade : reportStats.encodedGrades}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4 sm:p-6">
                  <div className="print-container mx-auto max-w-5xl rounded-3xl border border-green-100 bg-white shadow-sm">
                    <div ref={printRef} className="print-page p-6 sm:p-8">
                      <div className="page-break-inside-avoid">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex w-20 items-start justify-start">
                            <Image
                              src="/DePed-logo.png"
                              alt="DepEd Logo"
                              width={72}
                              height={72}
                              className="h-[68px] w-[68px] object-contain"
                              priority
                            />
                          </div>

                          <div className="flex-1 text-center">
                            <p className="text-sm text-gray-700">Republic of the Philippines</p>
                            <p className="text-lg font-bold text-gray-900">Department of Education</p>
                            <p className="mt-1 text-2xl font-bold tracking-wide text-green-900">
                              Qorban Institute of Technology Training and Assessment Center, Inc
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-700">
                              {getReportTitle(selectedReportType)}
                            </p>
                          </div>

                          <div className="flex w-20 items-start justify-end">
                            <Image
                              src="/logo.jpg"
                              alt="Qorban Logo"
                              width={72}
                              height={72}
                              className="h-[68px] w-[68px] object-contain"
                              priority
                            />
                          </div>
                        </div>

                        <div className="mt-5 grid gap-x-8 gap-y-2 border-y border-gray-300 py-4 text-sm text-gray-800 sm:grid-cols-2">
                          <p>
                            <span className="font-semibold">Teacher:</span> {getTeacherName(teacher)}
                          </p>
                          <p>
                            <span className="font-semibold">Teacher No:</span> {teacher?.teacher_no ?? '—'}
                          </p>
                          <p>
                            <span className="font-semibold">Academic Year:</span> {selectedSchoolYear || '—'}
                          </p>
                          <p>
                            <span className="font-semibold">Period:</span> {selectedGradingPeriod} Grading Period
                          </p>
                          <p>
                            <span className="font-semibold">Subject:</span> {selectedClassLabel}
                          </p>
                          <p>
                            <span className="font-semibold">Grade / Section:</span>{' '}
                            {selectedClass ? `${selectedClass.grade_level} / ${selectedClass.section}` : '—'}
                          </p>
                          <p>
                            <span className="font-semibold">Semester:</span> {selectedSemester}
                          </p>
                          <p>
                            <span className="font-semibold">Report Type:</span>{' '}
                            {getReportTitle(selectedReportType)}
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                          <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-2 font-medium text-green-800">
                            <Users className="h-4 w-4" />
                            {filteredRows.length} student{filteredRows.length !== 1 ? 's' : ''}
                          </div>

                          {selectedReportType === 'class_list_with_grades' && (
                            <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-2 font-medium text-green-800">
                              <FileSpreadsheet className="h-4 w-4" />
                              Average Grade: {averageGrade}
                            </div>
                          )}
                        </div>
                      </div>

                      {filteredRows.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                          No report data found for this selection.
                        </div>
                      ) : (
                        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-300">
                          <table className="w-full table-fixed border-collapse">
                            <colgroup>
                              <col className="w-[52px]" />
                              <col className={selectedReportType === 'attendance_sheet' ? 'w-[34%]' : 'w-[40%]'} />
                              <col className={selectedReportType === 'attendance_sheet' ? 'w-[16%]' : 'w-[20%]'} />

                              {(selectedReportType === 'class_list_only' ||
                                selectedReportType === 'class_list_with_grades') && <col className="w-[12%]" />}

                              {selectedReportType === 'class_list_with_grades' && (
                                <>
                                  <col className="w-[10%]" />
                                  <col className="w-[18%]" />
                                </>
                              )}

                              {selectedReportType === 'attendance_sheet' &&
                                attendanceHeaders.map((label) => <col key={label} className="w-[5%]" />)}
                            </colgroup>

                            <thead className="bg-green-50">
                              <tr>
                                <th className="border border-gray-300 px-2 py-3 text-center text-sm font-semibold text-green-900">No.</th>
                                <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Full Name</th>
                                <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Grade & Section</th>

                                {(selectedReportType === 'class_list_only' ||
                                  selectedReportType === 'class_list_with_grades') && (
                                  <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Gender</th>
                                )}

                                {selectedReportType === 'class_list_with_grades' && (
                                  <>
                                    <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Grade</th>
                                    <th className="border border-gray-300 px-3 py-3 text-left text-sm font-semibold text-green-900">Remarks</th>
                                  </>
                                )}

                                {selectedReportType === 'attendance_sheet' &&
                                  attendanceHeaders.map((label) => (
                                    <th
                                      key={label}
                                      className="border border-gray-300 px-1 py-4 text-center text-sm font-semibold text-green-900"
                                    >
                                      &nbsp;
                                    </th>
                                  ))}
                              </tr>
                            </thead>

                            <tbody>
                              {filteredRows.map((row, index) => (
                                <tr key={row.student_id}>
                                  <td className="border border-gray-300 px-2 py-3 text-center text-sm text-gray-700 align-middle">
                                    {index + 1}
                                  </td>

                                  <td
                                    className={`border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle break-words ${
                                      selectedReportType === 'attendance_sheet' ? 'attendance-name' : ''
                                    }`}
                                  >
                                    {row.full_name}
                                  </td>

                                  <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle">
                                    {row.grade_and_section || '—'}
                                  </td>

                                  {(selectedReportType === 'class_list_only' ||
                                    selectedReportType === 'class_list_with_grades') && (
                                    <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle">
                                      {row.gender || '—'}
                                    </td>
                                  )}

                                  {selectedReportType === 'class_list_with_grades' && (
                                    <>
                                      <td className="border border-gray-300 px-3 py-3 text-sm font-medium text-gray-900 align-middle">
                                        {row.grade || '—'}
                                      </td>
                                      <td className="border border-gray-300 px-3 py-3 text-sm text-gray-700 align-middle break-words">
                                        {row.remarks || '—'}
                                      </td>
                                    </>
                                  )}

                                  {selectedReportType === 'attendance_sheet' &&
                                    attendanceHeaders.map((label) => (
                                      <td
                                        key={`${row.student_id}-${label}`}
                                        className="h-12 border border-gray-300 px-1 py-3 align-middle"
                                      >
                                        &nbsp;
                                      </td>
                                    ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="mt-12 grid gap-10 sm:grid-cols-2">
                        <div>
                          <p className="text-sm text-gray-600">Prepared by:</p>
                          <div className="mt-12 border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold text-gray-900">{getTeacherName(teacher)}</p>
                            <p className="text-xs text-gray-600">Subject Teacher</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-gray-600">Date Generated:</p>
                          <div className="mt-12 border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString()}</p>
                            <p className="text-xs text-gray-600">System Generated Report</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TeacherReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="text-sm text-gray-500">Loading reports...</p>
          </div>
        </div>
      }
    >
      <TeacherReportsPageContent />
    </Suspense>
  )
}