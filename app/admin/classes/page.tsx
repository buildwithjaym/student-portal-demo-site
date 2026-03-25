'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Pencil, Trash2, School, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Semester = '1st Semester' | '2nd Semester'
type GradeLevel = 'Grade 11' | 'Grade 12'

type SubjectOption = {
  id: string
  subject_code: string
  subject_name: string
  grade_level: GradeLevel
  semester: Semester
  is_active: boolean
}

type TeacherOption = {
  id: string
  teacher_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  is_active: boolean
}

type SectionOption = {
  id: string
  section_name: string
  grade_level: GradeLevel
  strand: string | null
  is_active: boolean
}

type AcademicYearRow = {
  id: string
  school_year: string
  is_active: boolean
}

type ClassRow = {
  id: string
  subject_id: string
  teacher_id: string | null
  grade_level: GradeLevel
  section: string
  school_year: string
  semester: Semester
  is_active: boolean
  created_at: string
  subjects: {
    id: string
    subject_code: string
    subject_name: string
    grade_level: GradeLevel
    semester: Semester
  } | null
  teachers:
    | {
        id: string
        teacher_no: string
        first_name: string
        middle_name: string | null
        last_name: string
        suffix: string | null
      }
    | null
}

type DuplicateAssignment = {
  classId: string
  teacherName: string
  subjectLabel: string
}

type ClassForm = {
  subject_id: string
  teacher_id: string
  grade_level: GradeLevel | ''
  section: string
  school_year: string
  semester: Semester | ''
  is_active: boolean
}

const initialForm: ClassForm = {
  subject_id: '',
  teacher_id: '',
  grade_level: '',
  section: '',
  school_year: '',
  semester: '',
  is_active: true,
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [activeSchoolYear, setActiveSchoolYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null)
  const [form, setForm] = useState<ClassForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)
  const [duplicateAssignment, setDuplicateAssignment] = useState<DuplicateAssignment | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  const pageSize = 8

  const selectedSubject = useMemo(() => {
    return subjects.find((subject) => subject.id === form.subject_id) ?? null
  }, [subjects, form.subject_id])

  const filteredSections = useMemo(() => {
    if (!form.grade_level) return []
    return sections.filter((section) => section.grade_level === form.grade_level)
  }, [sections, form.grade_level])

  const filteredClasses = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return classes

    return classes.filter((item) => {
      const subjectLabel =
        `${item.subjects?.subject_code ?? ''} ${item.subjects?.subject_name ?? ''}`.toLowerCase()
      const teacherLabel = item.teachers ? formatFullName(item.teachers).toLowerCase() : ''

      return (
        subjectLabel.includes(keyword) ||
        teacherLabel.includes(keyword) ||
        item.grade_level.toLowerCase().includes(keyword) ||
        item.section.toLowerCase().includes(keyword) ||
        item.school_year.toLowerCase().includes(keyword) ||
        item.semester.toLowerCase().includes(keyword)
      )
    })
  }, [classes, search])

  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / pageSize))

  const paginatedClasses = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClasses.slice(start, start + pageSize)
  }, [filteredClasses, currentPage])

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
  }

  const fetchLookupData = async () => {
    const [subjectsResult, teachersResult, sectionsResult] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, subject_code, subject_name, grade_level, semester, is_active')
        .eq('is_active', true)
        .order('subject_name', { ascending: true }),
      supabase
        .from('teachers')
        .select('id, teacher_no, first_name, middle_name, last_name, suffix, is_active')
        .eq('is_active', true)
        .order('last_name', { ascending: true }),
      supabase
        .from('sections')
        .select('id, section_name, grade_level, strand, is_active')
        .eq('is_active', true)
        .order('section_name', { ascending: true }),
    ])

    if (subjectsResult.error) {
      toast.error(subjectsResult.error.message)
    } else {
      setSubjects((subjectsResult.data as SubjectOption[]) ?? [])
    }

    if (teachersResult.error) {
      toast.error(teachersResult.error.message)
    } else {
      setTeachers((teachersResult.data as TeacherOption[]) ?? [])
    }

    if (sectionsResult.error) {
      toast.error(sectionsResult.error.message)
    } else {
      setSections((sectionsResult.data as SectionOption[]) ?? [])
    }
  }

  const fetchClasses = async () => {
    setLoading(true)

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
        created_at,
        subjects:subject_id (
          id,
          subject_code,
          subject_name,
          grade_level,
          semester
        ),
        teachers:teacher_id (
          id,
          teacher_no,
          first_name,
          middle_name,
          last_name,
          suffix
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setClasses([])
    } else {
      setClasses((data as ClassRow[]) ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchActiveSchoolYear()
    fetchLookupData()
    fetchClasses()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!selectedSubject) {
      setForm((prev) => ({
        ...prev,
        grade_level: '',
        semester: '',
        section: '',
      }))
      return
    }

    setForm((prev) => {
      const nextGradeLevel = selectedSubject.grade_level
      const nextSemester = selectedSubject.semester

      const sectionStillValid = sections.some(
        (section) =>
          section.section_name === prev.section &&
          section.grade_level === nextGradeLevel
      )

      return {
        ...prev,
        grade_level: nextGradeLevel,
        semester: nextSemester,
        section: sectionStillValid ? prev.section : '',
      }
    })
  }, [selectedSubject, sections])

  const resetForm = () => {
    setForm({
      ...initialForm,
      school_year: activeSchoolYear,
    })
    setEditingClass(null)
    setDuplicateAssignment(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (item: ClassRow) => {
    setEditingClass(item)
    setForm({
      subject_id: item.subject_id,
      teacher_id: item.teacher_id ?? '',
      grade_level: item.grade_level,
      section: item.section,
      school_year: item.school_year,
      semester: item.semester,
      is_active: item.is_active,
    })
    setDuplicateAssignment(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  useEffect(() => {
    if (!showModal) return

    setForm((prev) => ({
      ...prev,
      school_year: activeSchoolYear,
    }))
  }, [showModal, activeSchoolYear])

  useEffect(() => {
    const checkDuplicate = async () => {
      if (
        !showModal ||
        !form.subject_id ||
        !form.section ||
        !form.school_year ||
        !form.semester
      ) {
        setDuplicateAssignment(null)
        return
      }

      setCheckingDuplicate(true)

      let query = supabase
        .from('classes')
        .select(`
          id,
          subject_id,
          teacher_id,
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
        .eq('subject_id', form.subject_id)
        .eq('section', form.section)
        .eq('school_year', form.school_year)
        .eq('semester', form.semester)
        .eq('is_active', true)
        .limit(1)

      if (editingClass) {
        query = query.neq('id', editingClass.id)
      }

      const { data, error } = await query.maybeSingle()

      if (error) {
        setDuplicateAssignment(null)
        setCheckingDuplicate(false)
        return
      }

      const row = data as
        | {
            id: string
            subjects: {
              id: string
              subject_code: string
              subject_name: string
            } | null
            teachers:
              | {
                  id: string
                  first_name: string
                  middle_name: string | null
                  last_name: string
                  suffix: string | null
                }
              | null
          }
        | null

      if (!row) {
        setDuplicateAssignment(null)
        setCheckingDuplicate(false)
        return
      }

      const teacherName = row.teachers
        ? formatFullName(row.teachers)
        : 'Unassigned Teacher'

      const subjectLabel = row.subjects
        ? `${row.subjects.subject_code} - ${row.subjects.subject_name}`
        : 'Selected Subject'

      setDuplicateAssignment({
        classId: row.id,
        teacherName,
        subjectLabel,
      })

      setCheckingDuplicate(false)
    }

    checkDuplicate()
  }, [showModal, form.subject_id, form.section, form.school_year, form.semester, editingClass])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: name === 'is_active' ? value === 'true' : value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!activeSchoolYear) {
      toast.error('No active school year found.')
      return
    }

    if (duplicateAssignment) {
      toast.error(
        `This subject is already assigned to ${duplicateAssignment.teacherName} for section ${form.section}.`
      )
      return
    }

    const payload = {
      subject_id: form.subject_id,
      teacher_id: form.teacher_id || null,
      grade_level: form.grade_level,
      section: form.section.trim(),
      school_year: activeSchoolYear,
      semester: form.semester,
      is_active: form.is_active,
    }

    if (
      !payload.subject_id ||
      !payload.grade_level ||
      !payload.section ||
      !payload.school_year ||
      !payload.semester
    ) {
      toast.error('Please complete the required fields.')
      return
    }

    setSaving(true)

    if (editingClass) {
      const { error } = await supabase
        .from('classes')
        .update(payload)
        .eq('id', editingClass.id)

      if (error) {
        if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
          toast.error(
            'This subject is already assigned for the selected section, school year, and semester.'
          )
        } else {
          toast.error(error.message)
        }
      } else {
        toast.success('Class updated successfully.')
        closeModal()
        fetchClasses()
      }
    } else {
      const { error } = await supabase.from('classes').insert(payload)

      if (error) {
        if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
          toast.error(
            'This subject is already assigned for the selected section, school year, and semester.'
          )
        } else {
          toast.error(error.message)
        }
      } else {
        toast.success('Class added successfully.')
        closeModal()
        fetchClasses()
      }
    }

    setSaving(false)
  }

  const handleDeactivate = async (item: ClassRow) => {
    const confirmed = window.confirm(
      `Set class "${item.subjects?.subject_name ?? 'Unnamed Subject'} - ${item.section}" as inactive?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('classes')
      .update({ is_active: false })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Class set to inactive.')
      fetchClasses()
    }
  }

  const handleReactivate = async (item: ClassRow) => {
    const { error } = await supabase
      .from('classes')
      .update({ is_active: true })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Class reactivated.')
      fetchClasses()
    }
  }

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
          <h1 className="text-3xl font-bold text-green-900">Classes</h1>
          <p className="mt-1 text-gray-600">
            Manage class offerings by subject, teacher, section, school year, and semester.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-900"
        >
          <Plus className="h-5 w-5" />
          Add Class
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject, teacher, grade level, section, school year, or semester"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              Active SY: {activeSchoolYear || 'Not Set'}
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
              <School className="h-4 w-4" />
              {filteredClasses.length} class{filteredClasses.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Subject
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Teacher
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Grade Level
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Section
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  School Year
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Semester
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Status
                </th>
                <th className="px-4 py-4 text-right text-sm font-semibold text-green-900">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    Loading classes...
                  </td>
                </tr>
              ) : paginatedClasses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No classes found.
                  </td>
                </tr>
              ) : (
                paginatedClasses.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-green-950">
                        {item.subjects
                          ? `${item.subjects.subject_code} - ${item.subjects.subject_name}`
                          : '—'}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {item.teachers ? formatFullName(item.teachers) : 'Unassigned'}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">{item.grade_level}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.section}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.school_year}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.semester}</td>

                    <td className="px-4 py-4">
                      {item.is_active ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="rounded-xl bg-yellow-50 p-2 text-yellow-700 transition hover:bg-yellow-100"
                          title="Edit class"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {item.is_active ? (
                          <button
                            onClick={() => handleDeactivate(item)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Deactivate class"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(item)}
                            className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                            title="Reactivate class"
                          >
                            Restore
                          </button>
                        )}
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
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">
                    {editingClass ? 'Update Record' : 'New Class'}
                  </p>
                  <h2 className="text-2xl font-bold text-green-900">
                    {editingClass ? 'Edit Class' : 'Add Class'}
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                >
                  Close
                </button>
              </div>

              {!activeSchoolYear && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  No active school year found. Please activate one school year first.
                </div>
              )}

              {duplicateAssignment && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Duplicate class assignment</p>
                    <p>
                      {duplicateAssignment.subjectLabel} is already assigned to{' '}
                      <span className="font-bold uppercase">
                        {duplicateAssignment.teacherName}
                      </span>{' '}
                      for section <span className="font-bold">{form.section}</span>,{' '}
                      {form.school_year} - {form.semester}.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Subject *
                    </label>
                    <select
                      name="subject_id"
                      value={form.subject_id}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
                    >
                      <option value="">Select subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.subject_code} - {subject.subject_name}
                        </option>
                      ))}
                    </select>
                    {checkingDuplicate && (
                      <p className="mt-2 text-xs text-gray-500">Checking assignment...</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Teacher
                    </label>
                    <select
                      name="teacher_id"
                      value={form.teacher_id}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    >
                      <option value="">Unassigned</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.teacher_no} - {formatFullName(teacher)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Grade Level *
                    </label>
                    <input
                      value={form.grade_level}
                      readOnly
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none"
                      placeholder="Auto-filled from subject"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Section *
                    </label>
                    <select
                      name="section"
                      value={form.section}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
                      disabled={!form.grade_level}
                    >
                      <option value="">
                        {form.grade_level ? 'Select section' : 'Select subject first'}
                      </option>
                      {filteredSections.map((section) => (
                        <option key={section.id} value={section.section_name}>
                          {section.section_name}
                          {section.strand ? ` - ${section.strand}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      School Year *
                    </label>
                    <input
                      value={activeSchoolYear}
                      readOnly
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Semester *
                    </label>
                    <input
                      value={form.semester}
                      readOnly
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none"
                      placeholder="Auto-filled from subject"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      name="is_active"
                      value={String(form.is_active)}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving || !activeSchoolYear || !!duplicateAssignment}
                    className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editingClass
                        ? 'Updating...'
                        : 'Saving...'
                      : editingClass
                      ? 'Update Class'
                      : 'Save Class'}
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