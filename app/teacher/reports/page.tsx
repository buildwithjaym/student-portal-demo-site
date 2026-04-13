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
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

function formatDateOnly(value: Date) {
  return value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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
    <div className="rounded-3xl border border-green-100 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-green-950 sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}

function ReportDocument({
  teacher,
  selectedSchoolYear,
  selectedGradingPeriod,
  selectedSemester,
  selectedClass,
  selectedClassLabel,
  selectedReportType,
  filteredRows,
  attendanceHeaders,
  averageGrade,
  printRef,
  mode = 'print',
}: {
  teacher: TeacherRow | null
  selectedSchoolYear: string
  selectedGradingPeriod: GradingPeriod
  selectedSemester: Semester
  selectedClass: ClassRow | null
  selectedClassLabel: string
  selectedReportType: ReportType
  filteredRows: ReportRow[]
  attendanceHeaders: string[]
  averageGrade: string
  printRef?: React.RefObject<HTMLDivElement | null>
  mode?: 'preview' | 'print'
}) {
  const isPreview = mode === 'preview'

  return (
    <div
      className={
        isPreview
          ? 'mx-auto w-full max-w-[980px] rounded-[24px] border border-green-100 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]'
          : 'mx-auto w-full max-w-[980px] bg-white'
      }
    >
      <div
        ref={printRef}
        className={[
          'print-page bg-white',
          isPreview
            ? 'p-3 sm:p-5 lg:p-7 [transform:scale(0.94)] sm:[transform:scale(0.98)] lg:[transform:scale(1)] origin-top'
            : 'p-0',
        ].join(' ')}
      >
        <div className={isPreview ? 'mx-auto w-[1064px] max-w-none bg-white' : 'w-full bg-white'}>
          <div className="page-break-inside-avoid px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex w-16 items-start justify-start sm:w-20">
                <Image
                  src="/DePed-logo.png"
                  alt="DepEd Logo"
                  width={72}
                  height={72}
                  className="h-[44px] w-[44px] object-contain sm:h-[68px] sm:w-[68px]"
                  priority
                />
              </div>

              <div className="flex-1 text-center">
                <p className="text-[10px] text-gray-700 sm:text-sm">Republic of the Philippines</p>
                <p className="text-sm font-bold text-gray-900 sm:text-[18px]">
                  Department of Education
                </p>
                <p className="mt-2 text-[18px] font-bold tracking-wide text-green-900 sm:text-[22px]">
                  Qorban Institute of Technology Training and Assessment Center, Inc
                </p>
                <p className="mt-1 text-xs font-medium text-gray-700 sm:text-sm">
                  {getReportTitle(selectedReportType)}
                </p>
              </div>

              <div className="flex w-16 items-start justify-end sm:w-20">
                <Image
                  src="/logo.jpg"
                  alt="Qorban Logo"
                  width={72}
                  height={72}
                  className="h-[44px] w-[44px] object-contain sm:h-[68px] sm:w-[68px]"
                  priority
                />
              </div>
            </div>

            <div className="mt-5 grid gap-x-10 gap-y-3 border-y border-gray-300 py-5 text-[13px] text-gray-800 sm:text-sm md:grid-cols-2">
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-3 py-2 font-medium text-green-800 sm:px-4">
                <Users className="h-4 w-4" />
                {filteredRows.length} student{filteredRows.length !== 1 ? 's' : ''}
              </div>

              {selectedReportType === 'class_list_with_grades' && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-3 py-2 font-medium text-green-800 sm:px-4">
                  <FileSpreadsheet className="h-4 w-4" />
                  Average Grade: {averageGrade}
                </div>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                No report data found for this selection.
              </div>
            ) : (
              <div
                className={
                  isPreview
                    ? 'report-table-wrap mt-6 overflow-x-auto rounded-[22px] border border-gray-300'
                    : 'report-table-wrap mt-6 overflow-visible border border-gray-300'
                }
              >
                <table className={isPreview ? 'min-w-full border-collapse bg-white' : 'w-full border-collapse bg-white'}>
                  <colgroup>
                    <col className="w-[52px]" />
                    <col
                      className={
                        selectedReportType === 'attendance_sheet'
                          ? isPreview
                            ? 'min-w-[260px]'
                            : 'w-[34%]'
                          : isPreview
                            ? 'min-w-[320px]'
                            : 'w-[60%]'
                      }
                    />

                    {(selectedReportType === 'class_list_only' ||
                      selectedReportType === 'class_list_with_grades') && (
                      <col className={isPreview ? 'min-w-[140px]' : 'w-[14%]'} />
                    )}

                    {selectedReportType === 'class_list_with_grades' && (
                      <>
                        <col className={isPreview ? 'min-w-[110px]' : 'w-[10%]'} />
                        <col className={isPreview ? 'min-w-[200px]' : 'w-[16%]'} />
                      </>
                    )}

                    {selectedReportType === 'attendance_sheet' &&
                      attendanceHeaders.map((label) => (
                        <col key={label} className={isPreview ? 'w-[48px]' : 'w-[6.6%]'} />
                      ))}
                  </colgroup>

                  <thead className="bg-green-50">
                    <tr>
                      <th className="border border-gray-300 px-2 py-3 text-center text-xs font-semibold text-green-900 sm:text-sm">
                        No.
                      </th>
                      <th className="border border-gray-300 px-3 py-3 text-left text-xs font-semibold text-green-900 sm:text-sm">
                        Full Name
                      </th>

                      {(selectedReportType === 'class_list_only' ||
                        selectedReportType === 'class_list_with_grades') && (
                        <th className="border border-gray-300 px-3 py-3 text-left text-xs font-semibold text-green-900 sm:text-sm">
                          Gender
                        </th>
                      )}

                      {selectedReportType === 'class_list_with_grades' && (
                        <>
                          <th className="border border-gray-300 px-3 py-3 text-left text-xs font-semibold text-green-900 sm:text-sm">
                            Grade
                          </th>
                          <th className="border border-gray-300 px-3 py-3 text-left text-xs font-semibold text-green-900 sm:text-sm">
                            Remarks
                          </th>
                        </>
                      )}

                      {selectedReportType === 'attendance_sheet' &&
                        attendanceHeaders.map((label) => (
                          <th
                            key={label}
                            className="border border-gray-300 px-1 py-3 text-center text-[10px] font-semibold text-green-900 sm:text-xs"
                          >
                            &nbsp;
                          </th>
                        ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={row.student_id}>
                        <td className="border border-gray-300 px-2 py-3 text-center align-middle text-xs text-gray-700 sm:text-sm">
                          {index + 1}
                        </td>

                        <td
                          className={`border border-gray-300 px-3 py-3 align-middle text-xs text-gray-700 break-words sm:text-sm ${
                            selectedReportType === 'attendance_sheet' ? 'attendance-name' : ''
                          }`}
                        >
                          {row.full_name}
                        </td>

                        {(selectedReportType === 'class_list_only' ||
                          selectedReportType === 'class_list_with_grades') && (
                          <td className="border border-gray-300 px-3 py-3 align-middle text-xs text-gray-700 sm:text-sm">
                            {row.gender || '—'}
                          </td>
                        )}

                        {selectedReportType === 'class_list_with_grades' && (
                          <>
                            <td className="border border-gray-300 px-3 py-3 align-middle text-xs font-medium text-gray-900 sm:text-sm">
                              {row.grade || '—'}
                            </td>
                            <td className="border border-gray-300 px-3 py-3 align-middle text-xs text-gray-700 break-words sm:text-sm">
                              {row.remarks || '—'}
                            </td>
                          </>
                        )}

                        {selectedReportType === 'attendance_sheet' &&
                          attendanceHeaders.map((label) => (
                            <td
                              key={`${row.student_id}-${label}`}
                              className="h-10 border border-gray-300 px-1 py-2 align-middle sm:h-12 sm:py-3"
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

            <div className="mt-12 grid gap-12 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-600 sm:text-sm">Prepared by:</p>
                <div className="mt-12 border-t border-gray-500 pt-2">
                  <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                    {getTeacherName(teacher)}
                  </p>
                  <p className="text-[11px] text-gray-600 sm:text-xs">Subject Teacher</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-600 sm:text-sm">Date Generated:</p>
                <div className="mt-12 border-t border-gray-500 pt-2">
                  <p className="text-xs font-semibold text-gray-900 sm:text-sm">
                    {new Date().toLocaleDateString()}
                  </p>
                  <p className="text-[11px] text-gray-600 sm:text-xs">System Generated Report</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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

  useEffect(() => {
    if (!previewOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [previewOpen])

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

  const handleDownloadPdf = async (classId: string) => {
    try {
      if (!teacher?.id || !selectedSchoolYear) {
        toast.error('Missing report details.')
        return
      }

      const semester = getSemesterFromPeriod(selectedGradingPeriod)

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
        .eq('teacher_id', teacher.id)
        .eq('school_year', selectedSchoolYear)
        .eq('semester', semester)
        .maybeSingle()

      if (classError || !classData) {
        toast.error('Class not found.')
        return
      }

      const normalizedClass = normalizeClassRow(classData as RawClassRow)

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
          .eq('school_year', selectedSchoolYear)
          .eq('semester', semester),
        supabase
          .from('grades')
          .select('student_id, grade, remarks')
          .eq('class_id', classId)
          .eq('school_year', selectedSchoolYear)
          .eq('semester', semester)
          .eq('grading_period', selectedGradingPeriod),
      ])

      if (enrollmentsResult.error) {
        toast.error(enrollmentsResult.error.message)
        return
      }

      if (gradesResult.error) {
        toast.error(gradesResult.error.message)
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

      const exportRows: ReportRow[] = enrollments
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

      const numericGrades = exportRows
        .map((row) => Number(row.grade))
        .filter((value) => !Number.isNaN(value))

      const exportAverageGrade =
        numericGrades.length > 0
          ? (numericGrades.reduce((sum, value) => sum + value, 0) / numericGrades.length).toFixed(2)
          : '—'

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageHeight = doc.internal.pageSize.getHeight()
      const marginX = 15
      let cursorY = 15

      const logoBase64 = await fetch('/logo.jpg')
        .then((res) => res.blob())
        .then(
          (blob) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
        )
        .catch(() => null)

      if (logoBase64) {
        doc.addImage(logoBase64, 'JPG', marginX, cursorY, 20, 20)
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('Qorban Institute of Technology Training and Assessment Center, Inc', marginX + 24, cursorY + 6)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Republic of the Philippines', marginX + 24, cursorY + 12)
      doc.text('Department of Education', marginX + 24, cursorY + 18)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(getReportTitle(selectedReportType), marginX, cursorY + 30)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Teacher: ${getTeacherName(teacher)}`, marginX, cursorY + 38)
      doc.text(`Teacher No: ${teacher?.teacher_no ?? '—'}`, marginX + 95, cursorY + 38)
      doc.text(`Academic Year: ${selectedSchoolYear || '—'}`, marginX, cursorY + 44)
      doc.text(`Grading Period: ${selectedGradingPeriod}`, marginX + 95, cursorY + 44)
      doc.text(
        `Subject: ${normalizedClass.subjects?.subject_code ?? '—'} - ${normalizedClass.subjects?.subject_name ?? 'Unnamed Subject'}`,
        marginX,
        cursorY + 50
      )
      doc.text(
        `Grade / Section: ${normalizedClass.grade_level} / ${normalizedClass.section}`,
        marginX,
        cursorY + 56
      )
      doc.text(`Semester: ${semester}`, marginX + 95, cursorY + 56)
      doc.text(`Generated: ${formatDateOnly(new Date())}`, marginX, cursorY + 62)

      if (selectedReportType === 'class_list_with_grades') {
        doc.text(`Average Grade: ${exportAverageGrade}`, marginX + 95, cursorY + 62)
      }

      cursorY += 72

      if (selectedReportType === 'class_list_only') {
        autoTable(doc, {
          startY: cursorY,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          head: [['No.', 'Full Name', 'Gender']],
          body: exportRows.map((row, index) => [
            String(index + 1),
            row.full_name,
            row.gender || '—',
          ]),
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
        })
      } else if (selectedReportType === 'class_list_with_grades') {
        autoTable(doc, {
          startY: cursorY,
          theme: 'grid',
          styles: {
            fontSize: 8.5,
            cellPadding: 3,
          },
          head: [['No.', 'Full Name', 'Gender', 'Grade', 'Remarks']],
          body: exportRows.map((row, index) => [
            String(index + 1),
            row.full_name,
            row.gender || '—',
            row.grade || '—',
            row.remarks || '—',
          ]),
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
        })
      } else {
        autoTable(doc, {
          startY: cursorY,
          theme: 'grid',
          head: [[
            'No.',
            'Full Name',
            'Day 1',
            'Day 2',
            'Day 3',
            'Day 4',
            'Day 5',
            'Day 6',
            'Day 7',
            'Day 8',
            'Day 9',
            'Day 10',
          ]],
          body: exportRows.map((row, index) => [
            String(index + 1),
            row.full_name,
            '', '', '', '', '', '', '', '', '', '',
          ]),
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
          styles: {
            fontSize: 7.5,
            cellPadding: 2.5,
          },
        })
      }

      const finalY = Math.min(
        ((doc as any).lastAutoTable?.finalY ?? cursorY) + 18,
        pageHeight - 30
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Prepared by:', marginX, finalY)
      doc.text('Generated by:', marginX + 95, finalY)

      doc.line(marginX, finalY + 16, marginX + 70, finalY + 16)
      doc.line(marginX + 95, finalY + 16, marginX + 165, finalY + 16)

      doc.setFont('helvetica', 'bold')
      doc.text(getTeacherName(teacher), marginX, finalY + 22)
      doc.text(getTeacherName(teacher), marginX + 95, finalY + 22)

      doc.setFont('helvetica', 'normal')
      doc.text('Subject Teacher', marginX, finalY + 27)
      doc.text(formatDateOnly(new Date()), marginX + 95, finalY + 27)

      const fileName = `${normalizedClass.subjects?.subject_code ?? 'report'}-${selectedReportType}-${selectedSchoolYear}.pdf`

      doc.save(fileName)
      toast.success('PDF report exported successfully.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to export PDF report.')
    }
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
        html,
        body {
          background: #f8fafc;
        }

        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: white !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden;
          }

          .print-only-area,
          .print-only-area * {
            visibility: visible;
          }

          .no-print,
          header,
          aside {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-only-area {
            display: block !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            background: white !important;
          }

          .print-container {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            background: white !important;
          }

          .print-page {
            padding: 0 !important;
            transform: none !important;
            zoom: 1 !important;
            background: white !important;
          }

          .report-table-wrap {
            overflow: visible !important;
            border-radius: 0 !important;
          }

          .report-table-wrap table {
            width: 100% !important;
            table-layout: fixed !important;
          }

          .page-break-inside-avoid {
            break-inside: avoid;
          }

          .attendance-name {
            font-size: 11px !important;
          }

          table,
          thead,
          tbody,
          tr,
          td,
          th {
            break-inside: avoid !important;
          }
        }
      `}</style>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="no-print overflow-hidden rounded-[28px] bg-gradient-to-r from-green-950 via-green-900 to-green-800 p-5 text-white shadow-xl sm:p-6"
      >
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-green-50 ring-1 ring-white/10">
              <FileText className="h-3.5 w-3.5" />
              Teacher Reports
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">
              Better reports, faster workflow
            </h1>
            <p className="mt-3 text-sm leading-6 text-green-50/90 sm:text-base">
              Choose a class, open a clean report preview, then print or save as PDF without leaving the page.
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
        className="no-print rounded-3xl border border-green-100 bg-white p-4 shadow-sm sm:p-5"
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
        className="no-print rounded-3xl border border-green-100 bg-white p-4 shadow-sm sm:p-5"
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
                  className={`rounded-3xl border p-4 shadow-sm transition sm:p-5 ${
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
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Students
                      </p>
                      <p className="mt-1 text-2xl font-bold text-green-950">{meta.studentCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 ring-1 ring-green-100">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Encoded
                      </p>
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
                      onClick={() => handleDownloadPdf(item.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.section>

      <div className="print-only-area hidden bg-white">
        <ReportDocument
          teacher={teacher}
          selectedSchoolYear={selectedSchoolYear}
          selectedGradingPeriod={selectedGradingPeriod}
          selectedSemester={selectedSemester}
          selectedClass={selectedClass}
          selectedClassLabel={selectedClassLabel}
          selectedReportType={selectedReportType}
          filteredRows={filteredRows}
          attendanceHeaders={attendanceHeaders}
          averageGrade={averageGrade}
          printRef={printRef}
          mode="print"
        />
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="no-print fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]"
          >
            <div className="flex h-dvh w-full items-center justify-center p-0 sm:p-4 lg:p-6">
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.985 }}
                className="flex h-dvh w-full flex-col bg-[#f8fafc] sm:h-[92vh] sm:max-h-[920px] sm:w-full sm:max-w-[1180px] sm:rounded-[28px] sm:shadow-2xl"
              >
                <div className="border-b border-green-100 bg-white/95 px-4 py-4 backdrop-blur sm:rounded-t-[28px] sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                </div>

                <div className="border-b border-green-100 bg-white px-4 py-4 sm:px-5">
                  <div className="grid gap-4 xl:grid-cols-[220px_280px_1fr]">
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

                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
                          {selectedReportType === 'class_list_with_grades'
                            ? averageGrade
                            : reportStats.encodedGrades}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-2 sm:p-4 lg:p-6">
                  <ReportDocument
                    teacher={teacher}
                    selectedSchoolYear={selectedSchoolYear}
                    selectedGradingPeriod={selectedGradingPeriod}
                    selectedSemester={selectedSemester}
                    selectedClass={selectedClass}
                    selectedClassLabel={selectedClassLabel}
                    selectedReportType={selectedReportType}
                    filteredRows={filteredRows}
                    attendanceHeaders={attendanceHeaders}
                    averageGrade={averageGrade}
                    printRef={printRef}
                    mode="preview"
                  />
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