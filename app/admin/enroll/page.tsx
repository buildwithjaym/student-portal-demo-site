'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, UserPlus, CheckCircle2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Student = {
  id: string
  student_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
  is_active: boolean
}

type ClassItem = {
  id: string
  grade_level: string
  section: string
  school_year: string
  semester: string
  is_active: boolean
  subjects: {
    subject_code: string
    subject_name: string
  } | null
  teachers: {
    first_name: string
    middle_name: string | null
    last_name: string
    suffix: string | null
  } | null
}

type EnrollmentItem = {
  id: string
  class_id: string
  school_year: string
  term: string
  classes: ClassItem | null
}

export default function EnrollmentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [schoolYear, setSchoolYear] = useState('2025-2026')
  const [semester, setSemester] = useState<'1st Semester' | '2nd Semester'>('1st Semester')
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [matchingClasses, setMatchingClasses] = useState<ClassItem[]>([])
  const [currentEnrollments, setCurrentEnrollments] = useState<EnrollmentItem[]>([])

  const fetchStudents = async () => {
    setLoadingStudents(true)

    const { data, error } = await supabase
      .from('students')
      .select(
        'id, student_no, first_name, middle_name, last_name, suffix, grade_level, section, is_active'
      )
      .eq('is_active', true)
      .order('last_name', { ascending: true })

    if (error) {
      toast.error(error.message)
      setStudents([])
    } else {
      setStudents(data ?? [])
    }

    setLoadingStudents(false)
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    const student = students.find((s) => s.id === selectedStudentId) ?? null
    setSelectedStudent(student)
  }, [selectedStudentId, students])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return students

    return students.filter((student) => {
      const name = formatFullName(student).toLowerCase()
      return (
        student.student_no.toLowerCase().includes(keyword) ||
        name.includes(keyword) ||
        student.grade_level.toLowerCase().includes(keyword) ||
        student.section.toLowerCase().includes(keyword)
      )
    })
  }, [students, search])

  const loadMatchingClassesAndEnrollments = async (
    student: Student,
    selectedSchoolYear: string,
    selectedSemester: '1st Semester' | '2nd Semester'
  ) => {
    setLoadingClasses(true)

    const [classesResult, enrollmentsResult] = await Promise.all([
      supabase
        .from('classes')
        .select(`
          id,
          grade_level,
          section,
          school_year,
          semester,
          is_active,
          subjects:subject_id (
            subject_code,
            subject_name
          ),
          teachers:teacher_id (
            first_name,
            middle_name,
            last_name,
            suffix
          )
        `)
        .eq('grade_level', student.grade_level)
        .eq('section', student.section)
        .eq('school_year', selectedSchoolYear)
        .eq('semester', selectedSemester)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),

      supabase
        .from('enrollments')
        .select(`
          id,
          class_id,
          school_year,
          term,
          classes:class_id (
            id,
            grade_level,
            section,
            school_year,
            semester,
            is_active,
            subjects:subject_id (
              subject_code,
              subject_name
            ),
            teachers:teacher_id (
              first_name,
              middle_name,
              last_name,
              suffix
            )
          )
        `)
        .eq('student_id', student.id)
        .eq('school_year', selectedSchoolYear)
        .eq('term', selectedSemester)
    ])

    if (classesResult.error) {
      toast.error(classesResult.error.message)
      setMatchingClasses([])
    } else {
      setMatchingClasses((classesResult.data as ClassItem[]) ?? [])
    }

    if (enrollmentsResult.error) {
      toast.error(enrollmentsResult.error.message)
      setCurrentEnrollments([])
    } else {
      setCurrentEnrollments((enrollmentsResult.data as EnrollmentItem[]) ?? [])
    }

    setLoadingClasses(false)
  }

  useEffect(() => {
    if (selectedStudent) {
      loadMatchingClassesAndEnrollments(selectedStudent, schoolYear, semester)
    } else {
      setMatchingClasses([])
      setCurrentEnrollments([])
    }
  }, [selectedStudent, schoolYear, semester])

  const handleAutoEnroll = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student first.')
      return
    }

    if (matchingClasses.length === 0) {
      toast.error('No matching active classes found for this student.')
      return
    }

    setEnrolling(true)

    const alreadyEnrolledClassIds = new Set(
      currentEnrollments.map((item) => item.class_id)
    )

    const rowsToInsert = matchingClasses
      .filter((item) => !alreadyEnrolledClassIds.has(item.id))
      .map((item) => ({
        student_id: selectedStudent.id,
        class_id: item.id,
        school_year: schoolYear,
        term: semester,
      }))

    if (rowsToInsert.length === 0) {
      toast.info('Student is already enrolled in all matching classes for this term.')
      setEnrolling(false)
      return
    }

    const { error } = await supabase.from('enrollments').insert(rowsToInsert)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Student enrolled successfully for the selected term.')
      await loadMatchingClassesAndEnrollments(selectedStudent, schoolYear, semester)
    }

    setEnrolling(false)
  }

  const enrolledClassIds = useMemo(() => {
    return new Set(currentEnrollments.map((item) => item.class_id))
  }, [currentEnrollments])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <p className="text-sm font-medium text-yellow-600">Administration</p>
          <h1 className="text-3xl font-bold text-green-900">Enroll Students</h1>
          <p className="mt-1 text-gray-600">
            Enroll students into all active classes matching their grade level, section, school year, and semester.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Search Student
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by student no, name, grade level, or section"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              School Year
            </label>
            <input
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="e.g. 2025-2026"
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as '1st Semester' | '2nd Semester')}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            >
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Select Student
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            disabled={loadingStudents}
          >
            <option value="">
              {loadingStudents ? 'Loading students...' : 'Choose a student'}
            </option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.student_no} - {formatFullName(student)} ({student.grade_level} / {student.section})
              </option>
            ))}
          </select>
        </div>

        {selectedStudent && (
          <div className="mt-5 rounded-2xl bg-green-50 p-4">
            <p className="text-sm font-medium text-yellow-700">Selected Student</p>
            <h2 className="mt-1 text-xl font-bold text-green-900">
              {formatFullName(selectedStudent)}
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              {selectedStudent.student_no} • {selectedStudent.grade_level} • {selectedStudent.section}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {schoolYear} • {semester}
            </p>

            <button
              onClick={handleAutoEnroll}
              disabled={enrolling || loadingClasses}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-5 w-5" />
              {enrolling ? 'Enrolling...' : 'Auto Enroll to Matching Classes'}
            </button>
          </div>
        )}
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold text-green-900">Matching Classes</h2>
          </div>

          {loadingClasses ? (
            <p className="text-gray-500">Loading matching classes...</p>
          ) : matchingClasses.length === 0 ? (
            <p className="text-gray-500">No matching active classes found.</p>
          ) : (
            <div className="space-y-3">
              {matchingClasses.map((item) => {
                const enrolled = enrolledClassIds.has(item.id)

                return (
                  <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-green-950">
                          {item.subjects
                            ? `${item.subjects.subject_code} - ${item.subjects.subject_name}`
                            : 'Unnamed Subject'}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {item.grade_level} • {item.section} • {item.school_year} • {item.semester}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Teacher: {item.teachers ? formatFullName(item.teachers) : 'Unassigned'}
                        </p>
                      </div>

                      {enrolled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          <CheckCircle2 className="h-4 w-4" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold text-green-900">Current Enrollments</h2>
          </div>

          {loadingClasses ? (
            <p className="text-gray-500">Loading enrollments...</p>
          ) : currentEnrollments.length === 0 ? (
            <p className="text-gray-500">Student has no enrollments yet for this semester.</p>
          ) : (
            <div className="space-y-3">
              {currentEnrollments.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                  <p className="font-semibold text-green-950">
                    {item.classes?.subjects
                      ? `${item.classes.subjects.subject_code} - ${item.classes.subjects.subject_name}`
                      : 'Unnamed Subject'}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.classes?.grade_level} • {item.classes?.section} • {item.classes?.school_year} • {item.classes?.semester}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Teacher: {item.classes?.teachers ? formatFullName(item.classes.teachers) : 'Unassigned'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}