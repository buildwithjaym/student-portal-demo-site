'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Trash2,
  Users,
  UserPlus,
  Sparkles,
} from 'lucide-react'
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

type SectionRow = {
  id: string
  section_name: string
  grade_level: string
  strand?: string | null
  is_active: boolean
  semester: Semester
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
  description?: string | null
  grade_level: string
  semester: Semester
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
  school_year: string
  semester: Semester
}

type RawClassRow = {
  id: string
  grade_level: string
  section: string
  school_year: string
  semester: Semester
  subjects: SubjectRow[] | SubjectRow | null
  teachers: TeacherRow[] | TeacherRow | null
}

type RawEnrollmentRow = {
  id: string
  school_year: string
  semester: Semester
  enrolled_at: string
  students: StudentRow[] | StudentRow | null
  classes: RawClassRow[] | RawClassRow | null
}

const initialForm: EnrollmentForm = {
  student_id: '',
  school_year: '',
  semester: '1st Semester',
}

function getSingleRelation<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeClassRow(row: RawClassRow): ClassRow {
  return {
    id: row.id,
    grade_level: row.grade_level,
    section: row.section,
    school_year: row.school_year,
    semester: row.semester,
    subjects: getSingleRelation(row.subjects),
    teachers: getSingleRelation(row.teachers),
  }
}

function normalizeEnrollmentRow(row: RawEnrollmentRow): EnrollmentRow {
  const rawClass = getSingleRelation(row.classes)

  return {
    id: row.id,
    school_year: row.school_year,
    semester: row.semester,
    enrolled_at: row.enrolled_at,
    students: getSingleRelation(row.students),
    classes: rawClass ? normalizeClassRow(rawClass) : null,
  }
}

export default function EnrollPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [sections, setSections] = useState<SectionRow[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [activeSchoolYear, setActiveSchoolYear] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const [search, setSearch] = useState('')
  const [semesterFilter, setSemesterFilter] = useState<'All' | Semester>('All')
  const [schoolYearFilter, setSchoolYearFilter] = useState('')

  const [studentDropdownSearch, setStudentDropdownSearch] = useState('')
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
    const [studentsResult, sectionsResult, classesResult] = await Promise.all([
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
        .from('sections')
        .select(`
          id,
          section_name,
          grade_level,
          strand,
          is_active,
          semester
        `)
        .eq('is_active', true)
        .order('section_name', { ascending: true }),

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
            subject_name,
            description,
            grade_level,
            semester
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

    if (sectionsResult.error) {
      toast.error(sectionsResult.error.message)
    } else {
      setSections((sectionsResult.data ?? []) as SectionRow[])
    }

    if (classesResult.error) {
      toast.error(classesResult.error.message)
    } else {
      const normalizedClasses = ((classesResult.data ?? []) as RawClassRow[]).map(
        normalizeClassRow
      )
      setClasses(normalizedClasses)
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
            subject_name,
            description,
            grade_level,
            semester
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
      const normalizedEnrollments = ((data ?? []) as RawEnrollmentRow[]).map(
        normalizeEnrollmentRow
      )
      setEnrollments(normalizedEnrollments)
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

  const selectedSectionInfo = useMemo(() => {
    if (!selectedStudent?.section || !selectedStudent?.grade_level) return null

    return (
      sections.find(
        (section) =>
          section.section_name === selectedStudent.section &&
          section.grade_level === selectedStudent.grade_level &&
          section.semester === form.semester &&
          section.is_active
      ) ?? null
    )
  }, [sections, selectedStudent, form.semester])

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

  const matchedClasses = useMemo(() => {
    if (!selectedStudent?.grade_level || !selectedStudent?.section) return []

    return classes
      .filter((item) => item.school_year === form.school_year)
      .filter((item) => item.semester === form.semester)
      .filter((item) => item.grade_level === selectedStudent.grade_level)
      .filter((item) => item.section === selectedStudent.section)
      .sort((a, b) => {
        const codeA = a.subjects?.subject_code ?? ''
        const codeB = b.subjects?.subject_code ?? ''
        return codeA.localeCompare(codeB)
      })
  }, [classes, form.school_year, form.semester, selectedStudent])

  const existingEnrollmentClassIds = useMemo(() => {
    if (!form.student_id || !form.school_year || !form.semester) {
      return new Set<string>()
    }

    return new Set(
      enrollments
        .filter(
          (item) =>
            item.students?.id === form.student_id &&
            item.school_year === form.school_year &&
            item.semester === form.semester
        )
        .map((item) => item.classes?.id)
        .filter(Boolean) as string[]
    )
  }, [enrollments, form.student_id, form.school_year, form.semester])

  const classesToEnroll = useMemo(() => {
    return matchedClasses.filter((item) => !existingEnrollmentClassIds.has(item.id))
  }, [matchedClasses, existingEnrollmentClassIds])

  const alreadyEnrolledClasses = useMemo(() => {
    return matchedClasses.filter((item) => existingEnrollmentClassIds.has(item.id))
  }, [matchedClasses, existingEnrollmentClassIds])

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

  const resetForm = () => {
    setForm({
      ...initialForm,
      school_year: activeSchoolYear,
    })
    setStudentDropdownSearch('')
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setForm({
      ...initialForm,
      school_year: activeSchoolYear,
    })
    setStudentDropdownSearch('')
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.student_id || !form.school_year || !form.semester) {
      toast.error('Please complete the required fields.')
      return
    }

    if (!selectedStudent) {
      toast.error('Selected student was not found.')
      return
    }

    if (!selectedStudent.grade_level || !selectedStudent.section) {
      toast.error(
        'Selected student does not have complete grade level or section information.'
      )
      return
    }

    if (!selectedSectionInfo) {
      toast.error(
        'The student section is not active or not available for the selected semester in the sections table.'
      )
      return
    }

    if (matchedClasses.length === 0) {
      toast.error(
        'No matching classes found for this student based on school year, semester, grade level, and section.'
      )
      return
    }

    if (classesToEnroll.length === 0) {
      toast.error(
        'This student is already enrolled in all matching subjects for the selected semester.'
      )
      return
    }

    setSaving(true)

    const payload = classesToEnroll.map((item) => ({
      student_id: form.student_id,
      class_id: item.id,
      school_year: form.school_year.trim(),
      semester: form.semester,
    }))

    const { error } = await supabase.from('enrollments').insert(payload)

    if (error) {
      if (
        error.code === '23505' ||
        error.message.toLowerCase().includes('duplicate')
      ) {
        toast.error('Some subjects are already enrolled for this student.')
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success(
        `${classesToEnroll.length} subject${classesToEnroll.length !== 1 ? 's' : ''} enrolled successfully.`
      )
      closeModal()
      fetchEnrollments()
    }

    setSaving(false)
  }

  const handleDelete = async (item: EnrollmentRow) => {
    const studentName = item.students
      ? formatFullName(item.students)
      : 'this student'
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
    <div className="w-full max-w-screen-2xl space-y-4 px-3 pb-4 sm:space-y-5 sm:px-4 lg:space-y-6 lg:px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 md:gap-4 xl:flex-row xl:items-center xl:justify-between"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-yellow-600 sm:text-sm">
            Administration
          </p>
          <h1 className="text-2xl font-bold text-green-900 sm:text-3xl">
            Enrollments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 sm:text-base">
            Automatically enroll a student into all matching classes with only a
            few clicks.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900 sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          Auto Enroll Student
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-3 shadow-sm sm:p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_220px_auto] xl:items-center">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search student, subject, teacher, school year, or semester"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
            />
          </div>

          <select
            value={schoolYearFilter}
            onChange={(e) => setSchoolYearFilter(e.target.value)}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
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
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
          >
            <option value="All">All Semesters</option>
            <option value="1st Semester">1st Semester</option>
            <option value="2nd Semester">2nd Semester</option>
          </select>

          <div className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800 xl:justify-start">
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
        <div className="hidden xl:block">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-green-50">
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                    Student
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                    Subject
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
                          {item.students?.grade_level
                            ? ` • ${item.students.grade_level}`
                            : ''}
                          {item.students?.section
                            ? ` • ${item.students.section}`
                            : ''}
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

                      <td className="px-4 py-4 text-sm text-gray-700">
                        {item.school_year}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {item.semester}
                      </td>
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
        </div>

        <div className="xl:hidden">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              Loading enrollments...
            </div>
          ) : paginatedEnrollments.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No enrollments found.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {paginatedEnrollments.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  className="space-y-3 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-green-700">
                        Student
                      </p>
                      <p className="truncate font-semibold text-green-950">
                        {item.students ? formatFullName(item.students) : '—'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.students?.student_no || 'No Student No.'}
                        {item.students?.grade_level
                          ? ` • ${item.students.grade_level}`
                          : ''}
                        {item.students?.section ? ` • ${item.students.section}` : ''}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(item)}
                      className="shrink-0 rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                      title="Remove enrollment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Subject
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {item.classes?.subjects
                          ? `${item.classes.subjects.subject_code} - ${item.classes.subjects.subject_name}`
                          : '—'}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {item.classes?.grade_level} • {item.classes?.section} •{' '}
                        {item.classes?.semester}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Teacher
                      </p>
                      <p className="mt-1 text-sm text-gray-900">
                        {item.classes?.teachers
                          ? formatFullName(item.classes.teachers)
                          : 'Unassigned'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        School Year
                      </p>
                      <p className="mt-1 text-sm text-gray-900">{item.school_year}</p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Semester
                      </p>
                      <p className="mt-1 text-sm text-gray-900">{item.semester}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Enrolled At
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(item.enrolled_at).toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-3 py-4 sm:px-4 sm:py-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
            >
              <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <p className="text-sm font-medium text-yellow-600">
                    Automatic Enrollment
                  </p>
                  <h2 className="text-xl font-bold text-green-900 sm:text-2xl">
                    Enroll Student
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-500 transition hover:bg-gray-100 sm:text-center"
                >
                  Close
                </button>
              </div>

              <form
                onSubmit={handleSave}
                className="flex max-h-[calc(100vh-2rem)] flex-col sm:max-h-[calc(100vh-3rem)]"
              >
                <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">
                          School Year *
                        </label>
                        <input
                          name="school_year"
                          value={form.school_year}
                          readOnly
                          className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none sm:text-base"
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
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
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
                          placeholder="Search and select student"
                          value={studentDropdownSearch}
                          onChange={(e) => setStudentDropdownSearch(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
                        />
                      </div>

                      <select
                        value={form.student_id}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            student_id: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-700 focus:ring-2 focus:ring-green-200 sm:text-base"
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
                            {selectedStudent.section
                              ? ` • ${selectedStudent.section}`
                              : ''}
                          </p>
                          {selectedSectionInfo && (
                            <p className="mt-1 text-sm text-gray-600">
                              Section Info: {selectedSectionInfo.section_name}
                              {selectedSectionInfo.strand
                                ? ` • ${selectedSectionInfo.strand}`
                                : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-800" />
                        <h3 className="font-semibold text-green-900">
                          Automatic Subject Matching
                        </h3>
                      </div>

                      {!selectedStudent ? (
                        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
                          Select a student and semester to automatically load
                          matching classes.
                        </div>
                      ) : matchedClasses.length === 0 ? (
                        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                          No matching classes found for this student based on
                          school year, semester, grade level, and section.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl bg-green-50 p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-green-700">
                                Matching Classes
                              </p>
                              <p className="mt-1 text-2xl font-bold text-green-900">
                                {matchedClasses.length}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-blue-50 p-4">
                              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                                Ready to Enroll
                              </p>
                              <p className="mt-1 text-2xl font-bold text-blue-900">
                                {classesToEnroll.length}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-gray-100 p-4 sm:col-span-2 xl:col-span-1">
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-700">
                                Already Enrolled
                              </p>
                              <p className="mt-1 text-2xl font-bold text-gray-900">
                                {alreadyEnrolledClasses.length}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-gray-200">
                            <div className="border-b border-gray-100 px-4 py-3">
                              <p className="font-semibold text-green-900">
                                Classes that will be processed
                              </p>
                              <p className="text-sm text-gray-500">
                                The system automatically matches classes using
                                the student’s grade level and section.
                              </p>
                            </div>

                            <div className="max-h-72 overflow-y-auto">
                              {matchedClasses.map((item) => {
                                const isAlreadyEnrolled =
                                  existingEnrollmentClassIds.has(item.id)

                                return (
                                  <div
                                    key={item.id}
                                    className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-900">
                                        {item.subjects
                                          ? `${item.subjects.subject_code} - ${item.subjects.subject_name}`
                                          : 'Unnamed Subject'}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {item.grade_level} • {item.section} •{' '}
                                        {item.semester}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        Teacher:{' '}
                                        {item.teachers
                                          ? formatFullName(item.teachers)
                                          : 'Unassigned'}
                                      </p>
                                    </div>

                                    <span
                                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                                        isAlreadyEnrolled
                                          ? 'bg-gray-200 text-gray-700'
                                          : 'bg-green-100 text-green-800'
                                      }`}
                                    >
                                      {isAlreadyEnrolled
                                        ? 'Already Enrolled'
                                        : 'Will Enroll'}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || !selectedStudent || classesToEnroll.length === 0}
                    className="w-full rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:opacity-60 sm:w-auto"
                  >
                    {saving
                      ? 'Enrolling...'
                      : `Enroll ${classesToEnroll.length > 0 ? classesToEnroll.length : ''} Subject${classesToEnroll.length === 1 ? '' : 's'}`}
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