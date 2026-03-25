'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Trash2, Users, UserPlus, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Semester = '1st Semester' | '2nd Semester'

type AcademicYearRow = {
  id: string
  school_year: string
  is_active: boolean
}

type StudentRow = {
  id: string
  student_no?: string | null
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  grade_level?: string | null
  section?: string | null
}

type TeacherRow = {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
}

type SubjectRow = {
  id: string
  subject_code: string
  subject_name: string
}

type ClassRow = {
  id: string
  grade_level: string
  section: string
  school_year: string
  semester: Semester
  subjects: SubjectRow | null
  teachers: TeacherRow | null
}

type EnrollmentRow = {
  id: string
  school_year: string
  semester: Semester
  enrolled_at: string
  students: StudentRow | null
  classes: ClassRow | null
}

type EnrollmentForm = {
  student_id: string
  class_id: string
  school_year: string
  semester: Semester
}

const initialForm: EnrollmentForm = {
  student_id: '',
  class_id: '',
  school_year: '',
  semester: '1st Semester',
}

export default function EnrollPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [activeSchoolYear, setActiveSchoolYear] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const [search, setSearch] = useState('')
  const [semesterFilter, setSemesterFilter] = useState<'All' | Semester>('All')
  const [schoolYearFilter, setSchoolYearFilter] = useState('')

  const [studentDropdownSearch, setStudentDropdownSearch] = useState('')
  const [classDropdownSearch, setClassDropdownSearch] = useState('')
  const [form, setForm] = useState<EnrollmentForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 10

  const fetchActiveSchoolYear = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      toast.error(error.message)
      setActiveSchoolYear('')
      return
    }

    const row = data as AcademicYearRow | null
    const schoolYear = row?.school_year ?? ''

    setActiveSchoolYear(schoolYear)
    setSchoolYearFilter((prev) => prev || schoolYear)
    setForm((prev) => ({
      ...prev,
      school_year: schoolYear,
    }))
  }

  const fetchLookupData = async () => {
    const [studentsResult, classesResult] = await Promise.all([
      supabase
        .from('students')
        .select(`
          id,
          student_no,
          first_name,
          middle_name,
          last_name,
          suffix,
          grade_level,
          section
        `)
        .order('last_name', { ascending: true }),

      supabase
        .from('classes')
        .select(`
          id,
          grade_level,
          section,
          school_year,
          semester,
          subjects:subject_id (
            id,
            subject_code,
            subject_name
          ),
          teachers:teacher_id (
            id,
            first_name,
            middle_name,
            last_name,
            suffix
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ])

    if (studentsResult.error) {
      toast.error(studentsResult.error.message)
    } else {
      setStudents((studentsResult.data ?? []) as StudentRow[])
    }

    if (classesResult.error) {
      toast.error(classesResult.error.message)
    } else {
      setClasses((classesResult.data ?? []) as ClassRow[])
    }
  }

  const fetchEnrollments = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        id,
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
          section
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
          ),
          teachers:teacher_id (
            id,
            first_name,
            middle_name,
            last_name,
            suffix
          )
        )
      `)
      .order('enrolled_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setEnrollments([])
    } else {
      setEnrollments((data ?? []) as EnrollmentRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchActiveSchoolYear()
    fetchLookupData()
    fetchEnrollments()
  }, [])

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === form.student_id) ?? null,
    [students, form.student_id]
  )

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === form.class_id) ?? null,
    [classes, form.class_id]
  )

  const availableSchoolYears = useMemo(() => {
    const values = new Set<string>()

    if (activeSchoolYear) values.add(activeSchoolYear)
    enrollments.forEach((item) => values.add(item.school_year))
    classes.forEach((item) => values.add(item.school_year))

    return [...values].filter(Boolean).sort((a, b) => b.localeCompare(a))
  }, [activeSchoolYear, enrollments, classes])

  const studentOptions = useMemo(() => {
    const keyword = studentDropdownSearch.trim().toLowerCase()

    return students.filter((student) => {
      if (!keyword) return true

      const fullName = formatFullName(student).toLowerCase()
      const studentNo = (student.student_no ?? '').toLowerCase()
      const gradeLevel = (student.grade_level ?? '').toLowerCase()
      const section = (student.section ?? '').toLowerCase()

      return (
        fullName.includes(keyword) ||
        studentNo.includes(keyword) ||
        gradeLevel.includes(keyword) ||
        section.includes(keyword)
      )
    })
  }, [students, studentDropdownSearch])

  const classOptions = useMemo(() => {
    const keyword = classDropdownSearch.trim().toLowerCase()

    return classes
      .filter((item) => !form.school_year || item.school_year === form.school_year)
      .filter((item) => item.semester === form.semester)
      .filter((item) => {
        if (selectedStudent?.grade_level && item.grade_level !== selectedStudent.grade_level) {
          return false
        }

        if (selectedStudent?.section && item.section !== selectedStudent.section) {
          return false
        }

        return true
      })
      .filter((item) => {
        if (!keyword) return true

        const subjectLabel =
          `${item.subjects?.subject_code ?? ''} ${item.subjects?.subject_name ?? ''}`.toLowerCase()
        const teacherLabel = item.teachers ? formatFullName(item.teachers).toLowerCase() : ''

        return (
          subjectLabel.includes(keyword) ||
          teacherLabel.includes(keyword) ||
          item.grade_level.toLowerCase().includes(keyword) ||
          item.section.toLowerCase().includes(keyword) ||
          item.semester.toLowerCase().includes(keyword)
        )
      })
  }, [
    classes,
    classDropdownSearch,
    form.school_year,
    form.semester,
    selectedStudent?.grade_level,
    selectedStudent?.section,
  ])

  const filteredEnrollments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return enrollments.filter((item) => {
      const studentLabel = item.students
        ? `${item.students.student_no ?? ''} ${formatFullName(item.students)} ${item.students.grade_level ?? ''} ${item.students.section ?? ''}`.toLowerCase()
        : ''

      const classLabel = item.classes
        ? `${item.classes.subjects?.subject_code ?? ''} ${item.classes.subjects?.subject_name ?? ''} ${item.classes.section} ${item.classes.semester} ${item.classes.teachers ? formatFullName(item.classes.teachers) : ''}`.toLowerCase()
        : ''

      const matchesSearch =
        !keyword ||
        studentLabel.includes(keyword) ||
        classLabel.includes(keyword) ||
        item.school_year.toLowerCase().includes(keyword) ||
        item.semester.toLowerCase().includes(keyword)

      const matchesSemester =
        semesterFilter === 'All' || item.semester === semesterFilter
      const matchesSchoolYear =
        !schoolYearFilter || item.school_year === schoolYearFilter

      return matchesSearch && matchesSemester && matchesSchoolYear
    })
  }, [enrollments, search, semesterFilter, schoolYearFilter])

  const totalPages = Math.max(1, Math.ceil(filteredEnrollments.length / pageSize))

  const paginatedEnrollments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredEnrollments.slice(start, start + pageSize)
  }, [filteredEnrollments, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, schoolYearFilter, semesterFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const isDuplicateEnrollment = useMemo(() => {
    if (!form.student_id || !form.class_id || !form.school_year || !form.semester) {
      return false
    }

    return enrollments.some(
      (item) =>
        item.students?.id === form.student_id &&
        item.classes?.id === form.class_id &&
        item.school_year === form.school_year &&
        item.semester === form.semester
    )
  }, [enrollments, form])

  const resetForm = () => {
    setForm({
      ...initialForm,
      school_year: activeSchoolYear,
    })
    setStudentDropdownSearch('')
    setClassDropdownSearch('')
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    if (name === 'semester') {
      setForm((prev) => ({
        ...prev,
        semester: value as Semester,
        class_id: '',
      }))
      return
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      student_id: form.student_id,
      class_id: form.class_id,
      school_year: form.school_year.trim(),
      semester: form.semester,
    }

    if (
      !payload.student_id ||
      !payload.class_id ||
      !payload.school_year ||
      !payload.semester
    ) {
      toast.error('Please complete the required fields.')
      return
    }

    const matchedClass = classes.find((item) => item.id === payload.class_id)

    if (!matchedClass) {
      toast.error('Selected class was not found.')
      return
    }

    if (matchedClass.school_year !== payload.school_year) {
      toast.error('Selected class does not match the active school year.')
      return
    }

    if (matchedClass.semester !== payload.semester) {
      toast.error('Selected class does not match the selected semester.')
      return
    }

    if (
      selectedStudent?.grade_level &&
      matchedClass.grade_level !== selectedStudent.grade_level
    ) {
      toast.error('Selected class does not match the student grade level.')
      return
    }

    if (selectedStudent?.section && matchedClass.section !== selectedStudent.section) {
      toast.error('Selected class does not match the student section.')
      return
    }

    if (isDuplicateEnrollment) {
      toast.error(
        'This student is already enrolled in the selected class for this school year and semester.'
      )
      return
    }

    setSaving(true)

    const { error } = await supabase.from('enrollments').insert(payload)

    if (error) {
      if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
        toast.error(
          'This student is already enrolled in the selected class for this school year and semester.'
        )
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success('Enrollment added successfully.')
      closeModal()
      fetchEnrollments()
    }

    setSaving(false)
  }

  const handleDelete = async (item: EnrollmentRow) => {
    const studentName = item.students ? formatFullName(item.students) : 'this student'
    const subjectName = item.classes?.subjects?.subject_name ?? 'this class'

    const confirmed = window.confirm(`Remove ${studentName} from ${subjectName}?`)
    if (!confirmed) return

    const { error } = await supabase.from('enrollments').delete().eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Enrollment removed successfully.')
      fetchEnrollments()
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <p className="text-sm font-medium text-yellow-600">Administration</p>
          <h1 className="text-3xl font-bold text-green-900">Enrollments</h1>
          <p className="mt-1 text-gray-600">
            Review and manage student enrollments quickly and clearly.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-900"
        >
          <Plus className="h-5 w-5" />
          Add Enrollment
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search student, class, teacher, school year, or semester"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <select
            value={schoolYearFilter}
            onChange={(e) => setSchoolYearFilter(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
          >
            <option value="">All School Years</option>
            {availableSchoolYears.map((sy) => (
              <option key={sy} value={sy}>
                {sy}
              </option>
            ))}
          </select>

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value as 'All' | Semester)}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
          >
            <option value="All">All Semesters</option>
            <option value="1st Semester">1st Semester</option>
            <option value="2nd Semester">2nd Semester</option>
          </select>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
            <Users className="h-4 w-4" />
            {filteredEnrollments.length} enrollment
            {filteredEnrollments.length !== 1 ? 's' : ''}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Student
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Class
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Teacher
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  School Year
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Semester
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Enrolled At
                </th>
                <th className="px-4 py-4 text-right text-sm font-semibold text-green-900">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Loading enrollments...
                  </td>
                </tr>
              ) : paginatedEnrollments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No enrollments found.
                  </td>
                </tr>
              ) : (
                paginatedEnrollments.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-green-950">
                        {item.students ? formatFullName(item.students) : '—'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.students?.student_no || 'No Student No.'}
                        {item.students?.grade_level ? ` • ${item.students.grade_level}` : ''}
                        {item.students?.section ? ` • ${item.students.section}` : ''}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-800">
                        {item.classes?.subjects
                          ? `${item.classes.subjects.subject_code} - ${item.classes.subjects.subject_name}`
                          : '—'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.classes?.grade_level} • {item.classes?.section} •{' '}
                        {item.classes?.semester}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {item.classes?.teachers
                        ? formatFullName(item.classes.teachers)
                        : 'Unassigned'}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">{item.school_year}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.semester}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {new Date(item.enrolled_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDelete(item)}
                          className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                          title="Remove enrollment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl max-h-[calc(100vh-3rem)]"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-yellow-600">New Enrollment</p>
                  <h2 className="text-2xl font-bold text-green-900">Enroll Student</h2>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSave} className="flex max-h-[calc(100vh-9rem)] flex-col">
                <div className="overflow-y-auto px-6 py-5">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          School Year *
                        </label>
                        <input
                          name="school_year"
                          value={form.school_year}
                          onChange={handleChange}
                          readOnly
                          className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          Semester *
                        </label>
                        <select
                          name="semester"
                          value={form.semester}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
                        >
                          <option value="1st Semester">1st Semester</option>
                          <option value="2nd Semester">2nd Semester</option>
                        </select>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-green-800" />
                        <h3 className="font-semibold text-green-900">Student</h3>
                      </div>

                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Search student before selecting"
                          value={studentDropdownSearch}
                          onChange={(e) => setStudentDropdownSearch(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
                        />
                      </div>

                      <select
                        value={form.student_id}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            student_id: e.target.value,
                            class_id: '',
                          }))
                        }
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      >
                        <option value="">Select student</option>
                        {studentOptions.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.student_no ? `${student.student_no} - ` : ''}
                            {formatFullName(student)}
                            {student.grade_level ? ` • ${student.grade_level}` : ''}
                            {student.section ? ` • ${student.section}` : ''}
                          </option>
                        ))}
                      </select>

                      {selectedStudent && (
                        <div className="mt-3 rounded-xl bg-green-50 p-3">
                          <p className="text-sm font-semibold text-green-900">
                            {formatFullName(selectedStudent)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedStudent.student_no || 'No Student No.'}
                            {selectedStudent.grade_level
                              ? ` • ${selectedStudent.grade_level}`
                              : ''}
                            {selectedStudent.section ? ` • ${selectedStudent.section}` : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-green-800" />
                        <h3 className="font-semibold text-green-900">Class</h3>
                      </div>

                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Search class before selecting"
                          value={classDropdownSearch}
                          onChange={(e) => setClassDropdownSearch(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
                        />
                      </div>

                      <select
                        value={form.class_id}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, class_id: e.target.value }))
                        }
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      >
                        <option value="">Select class</option>
                        {classOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.subjects
                              ? `${item.subjects.subject_code} - ${item.subjects.subject_name}`
                              : 'Unnamed Class'}
                            {` • ${item.grade_level} • ${item.section} • ${item.semester}`}
                          </option>
                        ))}
                      </select>

                      {selectedStudent && classOptions.length === 0 && (
                        <div className="mt-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                          No classes available for this student&apos;s grade level, section,
                          school year, and semester.
                        </div>
                      )}

                      {selectedClass && (
                        <div className="mt-3 rounded-xl bg-green-50 p-3">
                          <p className="text-sm font-semibold text-green-900">
                            {selectedClass.subjects
                              ? `${selectedClass.subjects.subject_code} - ${selectedClass.subjects.subject_name}`
                              : 'Unnamed Class'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedClass.grade_level} • {selectedClass.section} •{' '}
                            {selectedClass.semester}
                          </p>
                          <p className="text-sm text-gray-600">
                            Teacher:{' '}
                            {selectedClass.teachers
                              ? formatFullName(selectedClass.teachers)
                              : 'Unassigned'}
                          </p>
                        </div>
                      )}
                    </div>

                    {isDuplicateEnrollment && (
                      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                        This student is already enrolled in the selected class for this school
                        year and semester.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || isDuplicateEnrollment}
                    className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Enrollment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}