'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BookOpen,
  FileDown,
  GraduationCap,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'
type GradeLevel = 'Grade 11' | 'Grade 12' | 'All'
type ReportTab = 'enrollment' | 'risk'

type AcademicYearRow = {
  id: string
  school_year: string
  is_active: boolean
}

type StudentRow = {
  id: string
  student_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  is_active: boolean
}

type ClassRow = {
  id: string
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  school_year: string
  semester: Semester
  subjects: {
    id: string
    subject_code: string
    subject_name: string
  } | null
}

type EnrollmentRow = {
  id: string
  student_id: string
  class_id: string
  school_year: string
  semester: Semester
  enrolled_at: string
  students: StudentRow | null
  classes: ClassRow | null
}

type GradeRow = {
  id: string
  student_id: string
  class_id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  grade: number
  students: StudentRow | null
  classes: ClassRow | null
}

type ProfileRow = {
  id: string
  email: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  role: 'admin' | 'teacher' | 'student'
}

type EnrollmentSectionSummary = {
  gradeLevel: string
  section: string
  semester: Semester
  totalStudents: number
}

type AtRiskStudentRow = {
  studentId: string
  studentNo: string
  fullName: string
  gradeLevel: string
  section: string
  averageGrade: number
  failingSubjects: number
  totalSubjects: number
  status: 'At Risk' | 'Critical'
  subjectsBelow75: string[]
}

const SCHOOL_NAME =
  'Qorban Institute of Technology Training and Assessment Center, Inc'
const SCHOOL_ADDRESS = 'Isabela City, Zamboanga Peninsula'
const GRADING_PERIODS: GradingPeriod[] = ['1st', '2nd', '3rd', '4th']

function getSemesterFromGradingPeriod(period: GradingPeriod): Semester {
  return period === '1st' || period === '2nd' ? '1st Semester' : '2nd Semester'
}

function formatFullName(profile: {
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
}) {
  return [
    profile.first_name,
    profile.middle_name,
    profile.last_name,
    profile.suffix,
  ]
    .filter(Boolean)
    .join(' ')
}

function formatDateOnly(value: Date) {
  return value.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export default function AdminReportsPage() {
  const initializedRef = useRef(false)

  const [activeTab, setActiveTab] = useState<ReportTab>('enrollment')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])

  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] =
    useState<GradingPeriod>('1st')
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel>('All')
  const [selectedSection, setSelectedSection] = useState('All')

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [grades, setGrades] = useState<GradeRow[]>([])

  const selectedSemester = useMemo(
    () => getSemesterFromGradingPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const availableSections = useMemo(() => {
    const sectionSet = new Set<string>()

    enrollments.forEach((row) => {
      if (!row.students) return
      if (
        selectedGradeLevel !== 'All' &&
        row.students.grade_level !== selectedGradeLevel
      ) {
        return
      }
      sectionSet.add(row.students.section)
    })

    grades.forEach((row) => {
      if (!row.students) return
      if (
        selectedGradeLevel !== 'All' &&
        row.students.grade_level !== selectedGradeLevel
      ) {
        return
      }
      sectionSet.add(row.students.section)
    })

    return Array.from(sectionSet).sort((a, b) => a.localeCompare(b))
  }, [enrollments, grades, selectedGradeLevel])

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((row) => {
      const student = row.students
      if (!student || !student.is_active) return false
      if (row.school_year !== selectedSchoolYear) return false
      if (row.semester !== selectedSemester) return false
      if (
        selectedGradeLevel !== 'All' &&
        student.grade_level !== selectedGradeLevel
      ) {
        return false
      }
      if (selectedSection !== 'All' && student.section !== selectedSection) {
        return false
      }
      return true
    })
  }, [
    enrollments,
    selectedSchoolYear,
    selectedSemester,
    selectedGradeLevel,
    selectedSection,
  ])

  const enrollmentSectionSummary = useMemo<EnrollmentSectionSummary[]>(() => {
    const map = new Map<string, EnrollmentSectionSummary>()
    const uniqueStudentsPerSection = new Map<string, Set<string>>()

    filteredEnrollments.forEach((row) => {
      const student = row.students
      if (!student) return

      const key = `${student.grade_level}__${student.section}__${row.semester}`

      if (!map.has(key)) {
        map.set(key, {
          gradeLevel: student.grade_level,
          section: student.section,
          semester: row.semester,
          totalStudents: 0,
        })
        uniqueStudentsPerSection.set(key, new Set<string>())
      }

      uniqueStudentsPerSection.get(key)?.add(student.id)
    })

    map.forEach((value, key) => {
      value.totalStudents = uniqueStudentsPerSection.get(key)?.size ?? 0
    })

    return Array.from(map.values()).sort((a, b) => {
      const gradeCompare = a.gradeLevel.localeCompare(b.gradeLevel)
      if (gradeCompare !== 0) return gradeCompare
      return a.section.localeCompare(b.section)
    })
  }, [filteredEnrollments])

  const enrollmentSummary = useMemo(() => {
    const uniqueStudents = new Set<string>()
    const uniqueClasses = new Set<string>()
    const uniqueSections = new Set<string>()

    filteredEnrollments.forEach((row) => {
      if (row.student_id) uniqueStudents.add(row.student_id)
      if (row.class_id) uniqueClasses.add(row.class_id)
      if (row.students?.section) uniqueSections.add(row.students.section)
    })

    const grade11Count = new Set(
      filteredEnrollments
        .filter((row) => row.students?.grade_level === 'Grade 11')
        .map((row) => row.student_id)
    ).size

    const grade12Count = new Set(
      filteredEnrollments
        .filter((row) => row.students?.grade_level === 'Grade 12')
        .map((row) => row.student_id)
    ).size

    return {
      totalStudents: uniqueStudents.size,
      totalClasses: uniqueClasses.size,
      totalSections: uniqueSections.size,
      grade11Count,
      grade12Count,
    }
  }, [filteredEnrollments])

  const filteredGrades = useMemo(() => {
    return grades.filter((row) => {
      const student = row.students
      if (!student || !student.is_active) return false
      if (row.school_year !== selectedSchoolYear) return false
      if (row.semester !== selectedSemester) return false
      if (row.grading_period !== selectedGradingPeriod) return false
      if (
        selectedGradeLevel !== 'All' &&
        student.grade_level !== selectedGradeLevel
      ) {
        return false
      }
      if (selectedSection !== 'All' && student.section !== selectedSection) {
        return false
      }
      return true
    })
  }, [
    grades,
    selectedSchoolYear,
    selectedSemester,
    selectedGradingPeriod,
    selectedGradeLevel,
    selectedSection,
  ])

  const atRiskStudents = useMemo<AtRiskStudentRow[]>(() => {
    const map = new Map<
      string,
      {
        student: StudentRow
        grades: number[]
        failedSubjects: string[]
      }
    >()

    filteredGrades.forEach((row) => {
      const student = row.students
      if (!student) return

      const key = student.id
      if (!map.has(key)) {
        map.set(key, {
          student,
          grades: [],
          failedSubjects: [],
        })
      }

      const current = map.get(key)!
      current.grades.push(Number(row.grade))

      if (Number(row.grade) < 75) {
        const subjectLabel = row.classes?.subjects
          ? `${row.classes.subjects.subject_code} - ${row.classes.subjects.subject_name}`
          : 'Unnamed Subject'
        current.failedSubjects.push(subjectLabel)
      }
    })

    const result: AtRiskStudentRow[] = []

    map.forEach((value, studentId) => {
      if (value.grades.length === 0) return

      const average =
        value.grades.reduce((sum, item) => sum + item, 0) / value.grades.length
      const failingCount = value.failedSubjects.length

      let status: 'At Risk' | 'Critical' | null = null

      if (average < 75 && failingCount >= 3) {
        status = 'Critical'
      } else if (average < 75 || failingCount >= 2) {
        status = 'At Risk'
      }

      if (!status) return

      result.push({
        studentId,
        studentNo: value.student.student_no,
        fullName: formatFullName(value.student),
        gradeLevel: value.student.grade_level,
        section: value.student.section,
        averageGrade: Number(average.toFixed(2)),
        failingSubjects: failingCount,
        totalSubjects: value.grades.length,
        status,
        subjectsBelow75: value.failedSubjects,
      })
    })

    return result.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'Critical' ? -1 : 1
      }
      if (a.averageGrade !== b.averageGrade) {
        return a.averageGrade - b.averageGrade
      }
      return a.fullName.localeCompare(b.fullName)
    })
  }, [filteredGrades])

  const riskSummary = useMemo(() => {
    const critical = atRiskStudents.filter((item) => item.status === 'Critical')
    const atRisk = atRiskStudents.filter((item) => item.status === 'At Risk')

    return {
      total: atRiskStudents.length,
      critical: critical.length,
      atRisk: atRisk.length,
    }
  }, [atRiskStudents])

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, middle_name, last_name, suffix, role')
      .eq('id', user.id)
      .single()

    if (error || !data) {
      toast.error('Failed to load admin profile.')
      return null
    }

    const profileRow = data as ProfileRow
    setProfile(profileRow)
    return profileRow
  }

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message || 'Failed to load academic years.')
      setAcademicYears([])
      return null
    }

    const rows = (data ?? []) as AcademicYearRow[]
    setAcademicYears(rows)

    const activeYear = rows.find((row) => row.is_active)?.school_year ?? ''
    setSelectedSchoolYear((prev) => prev || activeYear || rows[0]?.school_year || '')

    return rows
  }

  const loadEnrollments = async (schoolYear: string) => {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        student_id,
        class_id,
        school_year,
        semester,
        enrolled_at,
        students:student_id (
          id,
          student_no,
          first_name,
          middle_name,
          last_name,
          suffix,
          grade_level,
          section,
          is_active
        ),
        classes:class_id (
          id,
          grade_level,
          section,
          school_year,
          semester,
          subjects:subject_id (
            id,
            subject_code,
            subject_name
          )
        )
      `)
      .eq('school_year', schoolYear)
      .order('enrolled_at', { ascending: false })

    if (error) {
      toast.error(error.message || 'Failed to load enrollments.')
      setEnrollments([])
      return
    }

    setEnrollments((data ?? []) as EnrollmentRow[])
  }

  const loadGrades = async (
    schoolYear: string,
    semester: Semester,
    period: GradingPeriod
  ) => {
    const { data, error } = await supabase
      .from('grades')
      .select(`
        id,
        student_id,
        class_id,
        school_year,
        semester,
        grading_period,
        grade,
        students:student_id (
          id,
          student_no,
          first_name,
          middle_name,
          last_name,
          suffix,
          grade_level,
          section,
          is_active
        ),
        classes:class_id (
          id,
          grade_level,
          section,
          school_year,
          semester,
          subjects:subject_id (
            id,
            subject_code,
            subject_name
          )
        )
      `)
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .eq('grading_period', period)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message || 'Failed to load grades.')
      setGrades([])
      return
    }

    setGrades((data ?? []) as GradeRow[])
  }

  const initialize = async () => {
    setLoading(true)
    await loadProfile()
    const years = await loadAcademicYears()
    const schoolYear =
      selectedSchoolYear ||
      years?.find((row) => row.is_active)?.school_year ||
      years?.[0]?.school_year ||
      ''

    if (schoolYear) {
      const semester = getSemesterFromGradingPeriod(selectedGradingPeriod)
      await Promise.all([
        loadEnrollments(schoolYear),
        loadGrades(schoolYear, semester, selectedGradingPeriod),
      ])
    }

    initializedRef.current = true
    setLoading(false)
  }

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!initializedRef.current || !selectedSchoolYear) return

    setLoading(true)
    Promise.all([
      loadEnrollments(selectedSchoolYear),
      loadGrades(selectedSchoolYear, selectedSemester, selectedGradingPeriod),
    ]).finally(() => setLoading(false))
  }, [selectedSchoolYear, selectedSemester, selectedGradingPeriod])

  useEffect(() => {
    if (selectedSection !== 'All' && !availableSections.includes(selectedSection)) {
      setSelectedSection('All')
    }
  }, [availableSections, selectedSection])

  const exportPdf = async () => {
    try {
      setExporting(true)

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
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
      doc.text(SCHOOL_NAME, marginX + 24, cursorY + 6)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(SCHOOL_ADDRESS, marginX + 24, cursorY + 12)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(
        activeTab === 'enrollment'
          ? 'Student Enrollment Summary Report'
          : 'At-Risk Students Report',
        marginX,
        cursorY + 30
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`School Year: ${selectedSchoolYear || '—'}`, marginX, cursorY + 38)
      doc.text(`Semester: ${selectedSemester}`, marginX + 55, cursorY + 38)
      doc.text(
        `Grading Period: ${selectedGradingPeriod}`,
        marginX + 100,
        cursorY + 38
      )
      doc.text(
        `Grade Level: ${selectedGradeLevel}`,
        marginX,
        cursorY + 44
      )
      doc.text(`Section: ${selectedSection}`, marginX + 55, cursorY + 44)
      doc.text(
        `Generated: ${formatDateOnly(new Date())}`,
        marginX + 100,
        cursorY + 44
      )

      cursorY += 52

      if (activeTab === 'enrollment') {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Summary', marginX, cursorY)

        autoTable(doc, {
          startY: cursorY + 4,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          head: [['Metric', 'Value']],
          body: [
            ['Total Enrolled Students', String(enrollmentSummary.totalStudents)],
            ['Total Classes', String(enrollmentSummary.totalClasses)],
            ['Total Sections', String(enrollmentSummary.totalSections)],
            ['Grade 11 Students', String(enrollmentSummary.grade11Count)],
            ['Grade 12 Students', String(enrollmentSummary.grade12Count)],
          ],
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
        })

        cursorY = (doc as any).lastAutoTable.finalY + 10

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Enrollment by Section', marginX, cursorY)

        autoTable(doc, {
          startY: cursorY + 4,
          theme: 'grid',
          styles: {
            fontSize: 9,
            cellPadding: 3,
          },
          head: [['Grade Level', 'Section', 'Semester', 'Total Students']],
          body: enrollmentSectionSummary.map((row) => [
            row.gradeLevel,
            row.section,
            row.semester,
            String(row.totalStudents),
          ]),
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
        })
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Summary', marginX, cursorY)

        autoTable(doc, {
          startY: cursorY + 4,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          head: [['Metric', 'Value']],
          body: [
            ['Total Flagged Students', String(riskSummary.total)],
            ['Critical Students', String(riskSummary.critical)],
            ['At Risk Students', String(riskSummary.atRisk)],
            ['Rule 1', 'At Risk = average below 75 or at least 2 failing subjects'],
            ['Rule 2', 'Critical = average below 75 and at least 3 failing subjects'],
          ],
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
        })

        cursorY = (doc as any).lastAutoTable.finalY + 10

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Detailed Student Report', marginX, cursorY)

        autoTable(doc, {
          startY: cursorY + 4,
          theme: 'grid',
          styles: {
            fontSize: 8.5,
            cellPadding: 2.5,
            valign: 'top',
          },
          head: [[
            'Student No',
            'Student Name',
            'Grade / Section',
            'Average',
            'Failing Subjects',
            'Status',
            'Subjects Below 75',
          ]],
          body: atRiskStudents.map((row) => [
            row.studentNo,
            row.fullName,
            `${row.gradeLevel} / ${row.section}`,
            row.averageGrade.toFixed(2),
            String(row.failingSubjects),
            row.status,
            row.subjectsBelow75.join(', ') || '—',
          ]),
          margin: { left: marginX, right: marginX },
          headStyles: {
            fillColor: [22, 101, 52],
          },
          didDrawPage: () => {
            const pageNumber = doc.getCurrentPageInfo().pageNumber
            doc.setFontSize(9)
            doc.setFont('helvetica', 'normal')
            doc.text(
              `Page ${pageNumber}`,
              pageWidth - marginX,
              pageHeight - 8,
              { align: 'right' }
            )
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
      doc.text(profile ? formatFullName(profile) : 'Administrator', marginX, finalY + 22)
      doc.text(profile ? formatFullName(profile) : 'Administrator', marginX + 95, finalY + 22)

      doc.setFont('helvetica', 'normal')
      doc.text('Administrator', marginX, finalY + 27)
      doc.text(formatDateOnly(new Date()), marginX + 95, finalY + 27)

      const fileName =
        activeTab === 'enrollment'
          ? `enrollment-summary-${selectedSchoolYear}-${selectedSemester}.pdf`
          : `at-risk-report-${selectedSchoolYear}-${selectedGradingPeriod}.pdf`

      doc.save(fileName)
      toast.success('PDF report exported successfully.')
    } catch (error) {
      console.error(error)
      toast.error('Failed to export PDF report.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <p className="text-sm font-medium text-yellow-600">Administration</p>
        <h1 className="text-3xl font-bold text-green-900">Reports</h1>
        <p className="text-gray-600">
          View database-driven reports and export structured PDF documents for official use.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_220px_220px_minmax(0,1fr)]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year
            </label>
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
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
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {GRADING_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {period} Grading Period
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Grade Level
            </label>
            <select
              value={selectedGradeLevel}
              onChange={(e) => setSelectedGradeLevel(e.target.value as GradeLevel)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="All">All Grade Levels</option>
              <option value="Grade 11">Grade 11</option>
              <option value="Grade 12">Grade 12</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Section
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="All">All Sections</option>
              {availableSections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('enrollment')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'enrollment'
                  ? 'bg-green-800 text-white'
                  : 'bg-green-50 text-green-800 hover:bg-green-100'
              }`}
            >
              Enrollment Summary
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('risk')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === 'risk'
                  ? 'bg-green-800 text-white'
                  : 'bg-green-50 text-green-800 hover:bg-green-100'
              }`}
            >
              At-Risk Students
            </button>
          </div>

          <button
            type="button"
            onClick={exportPdf}
            disabled={loading || exporting}
            className="inline-flex items-center gap-2 rounded-xl bg-green-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-900 disabled:opacity-60"
          >
            <FileDown className="h-4 w-4" />
            {exporting ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2">
          <p className="text-sm font-medium text-yellow-600">
            {activeTab === 'enrollment' ? 'Enrollment Report' : 'Risk Monitoring Report'}
          </p>
          <h2 className="text-2xl font-bold text-green-900">
            {activeTab === 'enrollment'
              ? 'Student Enrollment Summary'
              : 'At-Risk Students'}
          </h2>
          <p className="text-gray-600">
            {activeTab === 'enrollment'
              ? 'Semester-based enrollment report using filtered student and class data.'
              : 'Students are flagged using database-driven grading averages and failing subject counts.'}
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-green-50 p-8 text-center text-gray-500">
            Loading report data...
          </div>
        ) : activeTab === 'enrollment' ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-green-50 p-5">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-green-700" />
                  <p className="text-sm font-medium text-green-700">Total Enrolled</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-green-900">
                  {enrollmentSummary.totalStudents}
                </p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-5">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-blue-700" />
                  <p className="text-sm font-medium text-blue-700">Total Classes</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-blue-900">
                  {enrollmentSummary.totalClasses}
                </p>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-5">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-yellow-700" />
                  <p className="text-sm font-medium text-yellow-700">Grade 11</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-yellow-900">
                  {enrollmentSummary.grade11Count}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50 p-5">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-purple-700" />
                  <p className="text-sm font-medium text-purple-700">Grade 12</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-purple-900">
                  {enrollmentSummary.grade12Count}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-green-100">
              <div className="border-b border-green-100 px-5 py-4">
                <h3 className="text-lg font-bold text-green-900">Enrollment by Section</h3>
                <p className="text-sm text-gray-600">
                  Detailed section count for the selected semester and filters.
                </p>
              </div>

              {enrollmentSectionSummary.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500">
                  No enrollment records found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Grade Level
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Section
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Semester
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Total Students
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollmentSectionSummary.map((row, index) => (
                        <tr
                          key={`${row.gradeLevel}-${row.section}-${index}`}
                          className="border-t border-gray-100"
                        >
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {row.gradeLevel}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {row.section}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800">
                            {row.semester}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-900">
                            {row.totalStudents}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-red-50 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                  <p className="text-sm font-medium text-red-700">Critical</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-red-900">
                  {riskSummary.critical}
                </p>
              </div>

              <div className="rounded-2xl bg-yellow-50 p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-700" />
                  <p className="text-sm font-medium text-yellow-700">At Risk</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-yellow-900">
                  {riskSummary.atRisk}
                </p>
              </div>

              <div className="rounded-2xl bg-green-50 p-5">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-green-700" />
                  <p className="text-sm font-medium text-green-700">Total Flagged</p>
                </div>
                <p className="mt-3 text-3xl font-bold text-green-900">
                  {riskSummary.total}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-green-100">
              <div className="border-b border-green-100 px-5 py-4">
                <h3 className="text-lg font-bold text-green-900">At-Risk Students</h3>
                <p className="text-sm text-gray-600">
                  Database-driven student risk evaluation for the selected grading period.
                </p>
              </div>

              {atRiskStudents.length === 0 ? (
                <div className="px-5 py-10 text-center text-gray-500">
                  No at-risk students found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Class
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Average
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Failing Subjects
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-green-900">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRiskStudents.map((row) => (
                        <tr key={row.studentId} className="border-t border-gray-100 align-top">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-green-950">{row.fullName}</div>
                            <div className="text-sm text-gray-600">{row.studentNo}</div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-800">
                            {row.gradeLevel} • Section {row.section}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                            {row.averageGrade.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-800">
                            <div>{row.failingSubjects}</div>
                            <div className="mt-2 text-xs text-gray-600">
                              {row.subjectsBelow75.join(', ') || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                row.status === 'Critical'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-900'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}