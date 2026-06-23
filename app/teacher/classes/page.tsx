'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  CalendarRange,
  Clock3,
  Filter,
  GraduationCap,
  Layers3,
  Search,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

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
  semester: '1st Semester' | '2nd Semester'
  is_active: boolean
  subjects: SubjectRow | null
}

type RawClassRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  school_year: string
  semester: '1st Semester' | '2nd Semester'
  is_active: boolean
  subjects: SubjectRow[] | SubjectRow | null
}

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type SectionRow = {
  id: string
  section_name: string
  grade_level: 'Grade 11' | 'Grade 12'
  strand?: string | null
  semester: '1st Semester' | '2nd Semester'
  is_active: boolean
}

type MyClassRow = {
  classId: string
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  semester: '1st Semester' | '2nd Semester'
  schoolYear: string
  studentCount: number
  strand: string
  period: string
}

const ALL_SEMESTERS = 'All Semesters'
const ALL_PERIODS = 'All Periods'

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

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-green-950">{value}</p>
          <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-800">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function getPeriodFromSectionName(sectionName: string) {
  const name = sectionName.toLowerCase()
  if (name.includes('am')) return 'AM'
  if (name.includes('pm')) return 'PM'
  if (name.includes('morning')) return 'AM'
  if (name.includes('afternoon')) return 'PM'
  return 'Regular'
}

export default function TeacherClassesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState<string>(ALL_SEMESTERS)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(ALL_PERIODS)
  const [search, setSearch] = useState('')
  const [classes, setClasses] = useState<MyClassRow[]>([])

  const periodOptions = useMemo(() => {
    const unique = Array.from(new Set(classes.map((item) => item.period))).filter(Boolean)
    return [ALL_PERIODS, ...unique]
  }, [classes])

  const filteredClasses = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return classes.filter((item) => {
      const matchesSearch =
        !keyword ||
        [
          item.subjectName,
          item.subjectCode,
          item.gradeLevel,
          item.section,
          item.semester,
          item.strand,
          item.period,
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      const matchesSemester =
        selectedSemester === ALL_SEMESTERS || item.semester === selectedSemester

      const matchesPeriod =
        selectedPeriod === ALL_PERIODS || item.period === selectedPeriod

      return matchesSearch && matchesSemester && matchesPeriod
    })
  }, [classes, search, selectedSemester, selectedPeriod])

  const summary = useMemo(() => {
    return {
      totalClasses: filteredClasses.length,
      totalStudents: filteredClasses.reduce((sum, item) => sum + item.studentCount, 0),
      uniqueSubjects: new Set(filteredClasses.map((item) => item.subjectCode)).size,
      grade11Classes: filteredClasses.filter((item) => item.gradeLevel === 'Grade 11').length,
    }
  }, [filteredClasses])

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

  const loadClasses = async (teacherId: string, schoolYear: string) => {
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
      .eq('is_active', true)
      .order('semester', { ascending: true })
      .order('grade_level', { ascending: true })
      .order('section', { ascending: true })

    if (classesError) {
      toast.error(classesError.message)
      setClasses([])
      return
    }

    const classRows = ((classesData ?? []) as RawClassRow[]).map(normalizeClassRow)

    if (classRows.length === 0) {
      setClasses([])
      return
    }

    const classIds = classRows.map((item) => item.id)
    const sectionNames = Array.from(new Set(classRows.map((item) => item.section)))

    const [enrollmentsResult, sectionsResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select('class_id, student_id')
        .eq('school_year', schoolYear)
        .in('class_id', classIds),
      supabase
        .from('sections')
        .select('id, section_name, grade_level, strand, semester, is_active')
        .in('section_name', sectionNames),
    ])

    if (enrollmentsResult.error) {
      toast.error(enrollmentsResult.error.message)
      setClasses([])
      return
    }

    if (sectionsResult.error) {
      toast.error(sectionsResult.error.message)
      setClasses([])
      return
    }

    const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[]
    const sections = (sectionsResult.data ?? []) as SectionRow[]

    const enrollmentMap = new Map<string, Set<string>>()
    const sectionMap = new Map<string, SectionRow>()

    for (const row of enrollments) {
      if (!enrollmentMap.has(row.class_id)) {
        enrollmentMap.set(row.class_id, new Set())
      }
      enrollmentMap.get(row.class_id)!.add(row.student_id)
    }

    for (const row of sections) {
      sectionMap.set(`${row.section_name}-${row.grade_level}-${row.semester}`, row)
    }

    const rows: MyClassRow[] = classRows.map((cls) => {
      const sectionKey = `${cls.section}-${cls.grade_level}-${cls.semester}`
      const sectionInfo = sectionMap.get(sectionKey)

      return {
        classId: cls.id,
        subjectName: cls.subjects?.subject_name ?? 'Unnamed Subject',
        subjectCode: cls.subjects?.subject_code ?? '—',
        gradeLevel: cls.grade_level,
        section: cls.section,
        semester: cls.semester,
        schoolYear: cls.school_year,
        studentCount: (enrollmentMap.get(cls.id) ?? new Set()).size,
        strand: sectionInfo?.strand?.trim() || 'No strand set',
        period: getPeriodFromSectionName(cls.section),
      }
    })

    setClasses(rows)
    setSelectedPeriod(ALL_PERIODS)
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      const teacherRow = await loadGuard()
      if (!teacherRow) return

      await loadAcademicYears()
      setLoading(false)
    }

    initialize()
  }, [])

  useEffect(() => {
    if (!teacher?.id || !selectedSchoolYear) return
    loadClasses(teacher.id, selectedSchoolYear)
  }, [teacher?.id, selectedSchoolYear])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-gray-500">Loading my classes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-900 via-cyan-800 to-cyan-700 p-5 text-white shadow-xl sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-50 ring-1 ring-white/10">
              <BookOpen className="h-3.5 w-3.5" />
              My Classes
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {teacher ? formatFullName(teacher) : 'Teacher'}'s Classes
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/90 sm:text-base">
              A teacher view focused on assigned subjects, student count, semester,
              section strand, and period grouping.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              Teacher No: {teacher?.teacher_no ?? '—'}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              {selectedSchoolYear || 'No Academic Year'}
            </span>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Classes"
          value={summary.totalClasses}
          subtitle="Classes matching current filters"
          icon={Layers3}
        />
        <SummaryCard
          title="Students"
          value={summary.totalStudents}
          subtitle="Combined students across shown classes"
          icon={Users}
        />
        <SummaryCard
          title="Subjects"
          value={summary.uniqueSubjects}
          subtitle="Unique subjects in your load"
          icon={BookOpen}
        />
        <SummaryCard
          title="Grade 11"
          value={summary.grade11Classes}
          subtitle="Grade 11 classes in current view"
          icon={GraduationCap}
        />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-cyan-800" />
          <h2 className="text-lg font-bold text-cyan-900">Filters</h2>
        </div>

        <div className="grid gap-4 xl:grid-cols-[220px_220px_220px_1fr]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year
            </label>
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
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
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            >
              <option value={ALL_SEMESTERS}>{ALL_SEMESTERS}</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            >
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  {period}
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
                placeholder="Search subject, code, grade, section, strand, or period"
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
              />
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-cyan-100 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-cyan-900">Assigned Classes</h2>
            <p className="text-sm text-gray-600">Based on the assigned subjects.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
            <Users className="h-4 w-4" />
            {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {filteredClasses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No classes found for the selected filters.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClasses.map((item) => (
              <div
                key={item.classId}
                className="rounded-3xl border border-cyan-100 bg-gradient-to-b from-white to-cyan-50/40 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-green-950">{item.subjectName}</h3>
                    <p className="mt-1 text-sm font-medium text-gray-500">{item.subjectCode}</p>
                  </div>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                    {item.gradeLevel}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    Section {item.section}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {item.semester}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {item.period}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-cyan-100">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-cyan-100 p-2 text-cyan-800">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Students
                        </p>
                        <p className="text-2xl font-bold text-green-950">{item.studentCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 ring-1 ring-cyan-100">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-cyan-100 p-2 text-cyan-800">
                        <Clock3 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                          Period
                        </p>
                        <p className="text-xl font-bold text-green-950">{item.period}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-cyan-100 bg-white p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-cyan-800" />
                    <p className="text-sm font-semibold text-gray-800">Section Details</p>
                  </div>
                  <div className="grid gap-2 text-sm text-gray-600">
                    <p>
                      Strand: <span className="font-medium text-gray-900">{item.strand}</span>
                    </p>
                    <p>
                      School Year:{' '}
                      <span className="font-medium text-gray-900">{item.schoolYear}</span>
                    </p>
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