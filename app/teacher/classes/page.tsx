'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { BookOpen, FileText, GraduationCap, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

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

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type GradingWindowRow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
}

type ClassViewRow = {
  classId: string
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  schoolYear: string
  semester: Semester
  totalStudents: number
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

export default function TeacherClassesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedGradingPeriod, setSelectedGradingPeriod] = useState<GradingPeriod>('1st')
  const [availablePeriods, setAvailablePeriods] = useState<GradingPeriod[]>(ALL_PERIODS)
  const [gradingWindow, setGradingWindow] = useState<GradingWindowRow | null>(null)
  const [classes, setClasses] = useState<ClassViewRow[]>([])
  const [search, setSearch] = useState('')

  const selectedSemester = useMemo(
    () => getSemesterFromPeriod(selectedGradingPeriod),
    [selectedGradingPeriod]
  )

  const canEncodeGrades =
    gradingWindow?.is_open === true && gradingWindow?.is_locked === false

  const filteredClasses = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return classes

    return classes.filter((item) => {
      const subjectName = item.subjectName.toLowerCase()
      const subjectCode = item.subjectCode.toLowerCase()
      const gradeLevel = item.gradeLevel.toLowerCase()
      const section = item.section.toLowerCase()

      return (
        subjectName.includes(keyword) ||
        subjectCode.includes(keyword) ||
        gradeLevel.includes(keyword) ||
        section.includes(keyword)
      )
    })
  }, [classes, search])

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

    const rows = (data ?? []) as GradingWindowRow[]

    const uniquePeriods = Array.from(
      new Set(rows.map((row) => row.grading_period as GradingPeriod))
    ).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b))

    setAvailablePeriods(uniquePeriods.length > 0 ? uniquePeriods : ALL_PERIODS)

    const openWindow =
      rows
        .filter((row) => row.is_open && !row.is_locked)
        .sort(
          (a, b) =>
            getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
        )[0] ?? null

    const fallbackWindow =
      rows.sort(
        (a, b) =>
          getPeriodSortValue(a.grading_period) - getPeriodSortValue(b.grading_period)
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

  const loadClasses = async (
    teacherId: string,
    schoolYear: string,
    gradingPeriod: GradingPeriod
  ) => {
    const semester = getSemesterFromPeriod(gradingPeriod)

    if (!teacherId || !schoolYear) {
      setClasses([])
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
      setClasses([])
      return
    }

    const classRows = (classesData ?? []) as ClassRow[]

    if (classRows.length === 0) {
      setClasses([])
      return
    }

    const classIds = classRows.map((item) => item.id)

    const { data: enrollmentsData, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('class_id, student_id')
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .in('class_id', classIds)

    if (enrollmentsError) {
      toast.error(enrollmentsError.message)
      setClasses([])
      return
    }

    const enrollments = (enrollmentsData ?? []) as EnrollmentRow[]
    const enrollmentMap = new Map<string, Set<string>>()

    for (const row of enrollments) {
      if (!enrollmentMap.has(row.class_id)) enrollmentMap.set(row.class_id, new Set())
      enrollmentMap.get(row.class_id)!.add(row.student_id)
    }

    const rows: ClassViewRow[] = classRows.map((cls) => ({
      classId: cls.id,
      subjectName: cls.subjects?.subject_name ?? 'Unnamed Subject',
      subjectCode: cls.subjects?.subject_code ?? '—',
      gradeLevel: cls.grade_level,
      section: cls.section,
      schoolYear: cls.school_year,
      semester: cls.semester,
      totalStudents: (enrollmentMap.get(cls.id) ?? new Set()).size,
    }))

    setClasses(rows)
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
    if (!selectedSchoolYear) return
    loadSpecificWindow(selectedSchoolYear, selectedGradingPeriod)
  }, [selectedSchoolYear, selectedGradingPeriod])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear) return
    loadClasses(teacher.id, selectedSchoolYear, selectedGradingPeriod)
  }, [teacher?.id, selectedSchoolYear, selectedGradingPeriod])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-gray-500">Loading classes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 p-5 text-white shadow-xl sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-yellow-300">Teacher Classes</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">My Classes</h1>
            <p className="mt-2 max-w-2xl text-sm text-green-50/90">
              Review your assigned classes, student counts, and open grade encoding for the current grading period.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Search Classes
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, code, grade, or section"
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              />
            </div>
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
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-green-900">Assigned Class List</h2>
            <p className="text-sm text-gray-600">
              Only classes assigned to your account are shown here.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            <Users className="h-4 w-4" />
            {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No classes found for the selected academic year and grading period.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredClasses.map((item) => (
              <div
                key={item.classId}
                className="rounded-2xl border border-green-100 bg-green-50 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-green-900">{item.subjectName}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    {item.subjectCode}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                  <p>
                    Grade Level: <span className="font-medium">{item.gradeLevel}</span>
                  </p>
                  <p>
                    Section: <span className="font-medium">{item.section}</span>
                  </p>
                  <p>
                    Academic Year: <span className="font-medium">{item.schoolYear}</span>
                  </p>
                  <p>
                    Students: <span className="font-medium">{item.totalStudents}</span>
                  </p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/teacher/grades?classId=${item.classId}&schoolYear=${encodeURIComponent(
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
                        `/teacher/reports?classId=${item.classId}&schoolYear=${encodeURIComponent(
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
            ))}
          </div>
        )}
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-green-800" />
            <h3 className="font-bold text-green-900">Class Access</h3>
          </div>
          <p className="text-sm text-gray-600">
            You can only access classes officially assigned to your teacher account.
          </p>
        </div>

        <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-green-800" />
            <h3 className="font-bold text-green-900">Grade Encoding</h3>
          </div>
          <p className="text-sm text-gray-600">
            Encoding is available only when the selected grading period is open and not locked.
          </p>
        </div>

        <div className="rounded-3xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-800" />
            <h3 className="font-bold text-green-900">Reports</h3>
          </div>
          <p className="text-sm text-gray-600">
            Open reports to export class lists and official grade sheets for your handled subjects.
          </p>
        </div>
      </section>
    </div>
  )
}