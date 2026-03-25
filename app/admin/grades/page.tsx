'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Semester = '1st Semester' | '2nd Semester'
type GradingPeriod = '1st' | '2nd' | '3rd' | '4th'

type AcademicYear = {
  id: string
  school_year: string
  is_active: boolean
}

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
  description: string | null
  grade_level: 'Grade 11' | 'Grade 12'
}

type TeacherRow = {
  id: string
  teacher_no: string
  email: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  is_active: boolean
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

type EnrollmentRow = {
  class_id: string
  student_id: string
}

type GradeRow = {
  class_id: string
  student_id: string
}

type SubjectProgress = {
  classId: string
  subjectName: string
  subjectCode: string
  gradeLevel: string
  section: string
  teacherId: string | null
  teacherName: string
  totalStudents: number
  submittedGrades: number
  percentage: number
  status: 'Completed' | 'In Progress' | 'No Students' | 'No Teacher Assigned'
}

type TeacherProgress = {
  teacherId: string
  teacherName: string
  assignedSubjects: number
  completedSubjects: number
  inProgressSubjects: number
  averageProgress: number
}

const PERIODS_BY_SEMESTER: Record<Semester, GradingPeriod[]> = {
  '1st Semester': ['1st', '2nd'],
  '2nd Semester': ['3rd', '4th'],
}

function getSubjectName(subject: SubjectRow | null) {
  return subject?.subject_name || 'Unnamed Subject'
}

function getSubjectCode(subject: SubjectRow | null) {
  return subject?.subject_code || '—'
}

function getTeacherName(teacher: TeacherRow | null) {
  if (!teacher) return 'Unassigned Teacher'

  const parts = [
    teacher.first_name,
    teacher.middle_name,
    teacher.last_name,
    teacher.suffix,
  ].filter(Boolean)

  return parts.join(' ')
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-green-700 transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: SubjectProgress['status']
}) {
  const className =
    status === 'Completed'
      ? 'bg-green-100 text-green-800'
      : status === 'In Progress'
        ? 'bg-yellow-100 text-yellow-800'
        : status === 'No Students'
          ? 'bg-gray-200 text-gray-700'
          : 'bg-red-100 text-red-700'

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  )
}

export default function AdminGradesPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [schoolYear, setSchoolYear] = useState('')
  const [semester, setSemester] = useState<Semester>('1st Semester')
  const [gradingPeriod, setGradingPeriod] = useState<GradingPeriod>('1st')
  const [loading, setLoading] = useState(true)
  const [subjectRows, setSubjectRows] = useState<SubjectProgress[]>([])
  const [teacherRows, setTeacherRows] = useState<TeacherProgress[]>([])

  const availablePeriods = useMemo(() => {
    return PERIODS_BY_SEMESTER[semester]
  }, [semester])

  useEffect(() => {
    if (!availablePeriods.includes(gradingPeriod)) {
      setGradingPeriod(availablePeriods[0])
    }
  }, [availablePeriods, gradingPeriod])

  const overallSummary = useMemo(() => {
    const totalSubjects = subjectRows.length
    const completedSubjects = subjectRows.filter((row) => row.status === 'Completed').length
    const inProgressSubjects = subjectRows.filter((row) => row.status === 'In Progress').length
    const averageProgress =
      totalSubjects > 0
        ? Math.round(
            subjectRows.reduce((sum, row) => sum + row.percentage, 0) / totalSubjects
          )
        : 0

    return {
      totalSubjects,
      completedSubjects,
      inProgressSubjects,
      averageProgress,
    }
  }, [subjectRows])

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message)
      setAcademicYears([])
      setSchoolYear('')
      return
    }

    const rows = (data ?? []) as AcademicYear[]

    setAcademicYears(rows)

    if (rows.length === 0) {
      setSchoolYear('')
      return
    }

    const activeYear = rows.find((row) => row.is_active)
    setSchoolYear((prev) => prev || activeYear?.school_year || rows[0].school_year)
  }

  const loadPageData = async () => {
    if (!schoolYear) {
      setLoading(false)
      setSubjectRows([])
      setTeacherRows([])
      return
    }

    setLoading(true)

    try {
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
            subject_name,
            description,
            grade_level
          ),
          teachers:teacher_id (
            id,
            teacher_no,
            email,
            first_name,
            middle_name,
            last_name,
            suffix,
            is_active
          )
        `)
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .eq('is_active', true)

      if (classesError) throw classesError

      const classes = (classesData as ClassRow[]) || []

      if (classes.length === 0) {
        setSubjectRows([])
        setTeacherRows([])
        return
      }

      const classIds = classes.map((item) => item.id)

      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('class_id, student_id')
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .in('class_id', classIds)

      if (enrollmentsError) throw enrollmentsError

      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('class_id, student_id')
        .eq('school_year', schoolYear)
        .eq('semester', semester)
        .eq('grading_period', gradingPeriod)
        .in('class_id', classIds)

      if (gradesError) throw gradesError

      const enrollments = (enrollmentsData as EnrollmentRow[]) || []
      const grades = (gradesData as GradeRow[]) || []

      const enrollmentMap = new Map<string, Set<string>>()
      const submittedMap = new Map<string, Set<string>>()

      for (const row of enrollments) {
        if (!enrollmentMap.has(row.class_id)) {
          enrollmentMap.set(row.class_id, new Set())
        }
        enrollmentMap.get(row.class_id)!.add(row.student_id)
      }

      for (const row of grades) {
        if (!submittedMap.has(row.class_id)) {
          submittedMap.set(row.class_id, new Set())
        }
        submittedMap.get(row.class_id)!.add(row.student_id)
      }

      const subjectProgress: SubjectProgress[] = classes
        .map((cls) => {
          const enrolledStudents = enrollmentMap.get(cls.id) ?? new Set<string>()
          const submittedStudents = submittedMap.get(cls.id) ?? new Set<string>()

          const totalStudents = enrolledStudents.size
          const submittedGrades = submittedStudents.size
          const percentage =
            totalStudents > 0
              ? Math.round((submittedGrades / totalStudents) * 100)
              : 0

          let status: SubjectProgress['status'] = 'In Progress'

          if (!cls.teacher_id) {
            status = 'No Teacher Assigned'
          } else if (totalStudents === 0) {
            status = 'No Students'
          } else if (submittedGrades >= totalStudents) {
            status = 'Completed'
          }

          return {
            classId: cls.id,
            subjectName: getSubjectName(cls.subjects),
            subjectCode: getSubjectCode(cls.subjects),
            gradeLevel: cls.grade_level,
            section: cls.section,
            teacherId: cls.teacher_id,
            teacherName: getTeacherName(cls.teachers),
            totalStudents,
            submittedGrades,
            percentage,
            status,
          }
        })
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName))

      const teacherAggregateMap = new Map<string, TeacherProgress>()

      for (const row of subjectProgress) {
        if (!row.teacherId) continue

        const existing = teacherAggregateMap.get(row.teacherId)

        if (!existing) {
          teacherAggregateMap.set(row.teacherId, {
            teacherId: row.teacherId,
            teacherName: row.teacherName,
            assignedSubjects: 1,
            completedSubjects: row.status === 'Completed' ? 1 : 0,
            inProgressSubjects: row.status === 'In Progress' ? 1 : 0,
            averageProgress: row.percentage,
          })
        } else {
          existing.assignedSubjects += 1
          existing.completedSubjects += row.status === 'Completed' ? 1 : 0
          existing.inProgressSubjects += row.status === 'In Progress' ? 1 : 0
          existing.averageProgress += row.percentage
        }
      }

      const teacherProgress = Array.from(teacherAggregateMap.values())
        .map((teacher) => ({
          ...teacher,
          averageProgress:
            teacher.assignedSubjects > 0
              ? Math.round(teacher.averageProgress / teacher.assignedSubjects)
              : 0,
        }))
        .sort((a, b) => a.teacherName.localeCompare(b.teacherName))

      setSubjectRows(subjectProgress)
      setTeacherRows(teacherProgress)
    } catch (error: any) {
      toast.error(error.message || 'Failed to load grades monitoring.')
      setSubjectRows([])
      setTeacherRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    loadPageData()
  }, [schoolYear, semester, gradingPeriod])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <p className="text-sm font-medium text-yellow-600">Administration</p>
        <h1 className="text-3xl font-bold text-green-900">Grades Monitoring</h1>
        <p className="text-gray-600">
          Monitor grade submission progress by subject and by teacher.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Academic Year
            </label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="">Select academic year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.school_year}>
                  {year.school_year}{year.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as Semester)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Grading Period
            </label>
            <select
              value={gradingPeriod}
              onChange={(e) => setGradingPeriod(e.target.value as GradingPeriod)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              {availablePeriods.map((period) => (
                <option key={period} value={period}>
                  {period} Grading Period
                </option>
              ))}
            </select>
          </div>
        </div>

        {!schoolYear ? (
          <div className="mt-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
            No academic year available. Please create an academic year first.
          </div>
        ) : loading ? (
          <div className="mt-6 rounded-xl bg-green-50 p-5 text-gray-500">
            Loading grades monitoring...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-5">
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-sm text-gray-500">Overall Progress</p>
                <p className="mt-1 text-3xl font-bold text-green-900">
                  {overallSummary.averageProgress}%
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-white p-4">
                <p className="text-sm text-gray-500">Subjects</p>
                <p className="mt-1 text-3xl font-bold text-green-900">
                  {overallSummary.totalSubjects}
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-white p-4">
                <p className="text-sm text-gray-500">Completed</p>
                <p className="mt-1 text-3xl font-bold text-green-900">
                  {overallSummary.completedSubjects}
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-white p-4">
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="mt-1 text-3xl font-bold text-green-900">
                  {overallSummary.inProgressSubjects}
                </p>
              </div>

              <div className="rounded-2xl border border-green-100 bg-white p-4">
                <p className="text-sm text-gray-500">Teachers</p>
                <p className="mt-1 text-3xl font-bold text-green-900">
                  {teacherRows.length}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-bold text-green-900">Teacher Progress</h2>

              {teacherRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                  No teacher progress found for this selection.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {teacherRows.map((teacher) => (
                    <div
                      key={teacher.teacherId}
                      className="rounded-2xl border border-green-100 bg-green-50 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-bold text-green-900">
                            {teacher.teacherName}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            Subjects Assigned: {teacher.assignedSubjects}
                          </p>
                          <p className="text-sm text-gray-600">
                            Completed: {teacher.completedSubjects} / {teacher.assignedSubjects}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-green-800">
                          {teacher.averageProgress}%
                        </div>
                      </div>

                      <div className="mt-4">
                        <ProgressBar value={teacher.averageProgress} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-bold text-green-900">Subject Progress</h2>

              {subjectRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                  No classes found for this selection.
                </div>
              ) : (
                subjectRows.map((row) => (
                  <div
                    key={row.classId}
                    className="rounded-2xl border border-green-100 bg-green-50 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-bold text-green-900">
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

                        <p className="mt-2 text-sm text-gray-600">
                          Teacher: <span className="font-medium">{row.teacherName}</span>
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                          Submitted Grades: {row.submittedGrades} / {row.totalStudents}
                        </p>

                        <div className="mt-4">
                          <ProgressBar value={row.percentage} />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-gray-700">
                            {row.percentage}% complete
                          </p>
                          <StatusBadge status={row.status} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}