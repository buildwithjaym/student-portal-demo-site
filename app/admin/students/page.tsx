'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Pencil, Trash2, Users } from 'lucide-react'
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
  email: string | null
  grade_level: string
  section: string
  is_active: boolean
  created_at: string
}

type StudentForm = {
  student_no: string
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  email: string
  grade_level: string
  section: string
  is_active: boolean
}

const initialForm: StudentForm = {
  student_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  email: '',
  grade_level: 'Grade 11',
  section: '',
  is_active: true,
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 8

  const fetchStudents = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setStudents([])
    } else {
      setStudents(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return students

    return students.filter((student) => {
      const fullName = formatFullName(student).toLowerCase()

      return (
        student.student_no.toLowerCase().includes(keyword) ||
        fullName.includes(keyword) ||
        (student.email ?? '').toLowerCase().includes(keyword) ||
        student.grade_level.toLowerCase().includes(keyword) ||
        student.section.toLowerCase().includes(keyword)
      )
    })
  }, [students, search])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize))

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredStudents.slice(start, start + pageSize)
  }, [filteredStudents, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const resetForm = () => {
    setForm(initialForm)
    setEditingStudent(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (student: Student) => {
    setEditingStudent(student)
    setForm({
      student_no: student.student_no,
      first_name: student.first_name,
      middle_name: student.middle_name ?? '',
      last_name: student.last_name,
      suffix: student.suffix ?? '',
      email: student.email ?? '',
      grade_level: student.grade_level,
      section: student.section,
      is_active: student.is_active,
    })
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

    setForm((prev) => ({
      ...prev,
      [name]: name === 'is_active' ? value === 'true' : value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      student_no: form.student_no.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      suffix: form.suffix.trim() || null,
      email: form.email.trim() || null,
      grade_level: form.grade_level,
      section: form.section.trim(),
      is_active: form.is_active,
    }

    if (
      !payload.student_no ||
      !payload.first_name ||
      !payload.last_name ||
      !payload.grade_level ||
      !payload.section
    ) {
      toast.error('Please complete the required fields.')
      setSaving(false)
      return
    }

    if (editingStudent) {
      const { error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', editingStudent.id)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Student updated successfully.')
        closeModal()
        fetchStudents()
      }
    } else {
      const { error } = await supabase.from('students').insert(payload)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Student added successfully.')
        closeModal()
        fetchStudents()
      }
    }

    setSaving(false)
  }

  const handleDeactivate = async (student: Student) => {
    const confirmed = window.confirm(
      `Set ${formatFullName(student)} as inactive?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('students')
      .update({ is_active: false })
      .eq('id', student.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Student set to inactive.')
      fetchStudents()
    }
  }

  const handleReactivate = async (student: Student) => {
    const { error } = await supabase
      .from('students')
      .update({ is_active: true })
      .eq('id', student.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Student reactivated.')
      fetchStudents()
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
          <h1 className="text-3xl font-bold text-green-900">Students</h1>
          <p className="mt-1 text-gray-600">
            Manage student records, sections, and active status.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-900"
        >
          <Plus className="h-5 w-5" />
          Add Student
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
              placeholder="Search by student no, name, section, or grade level"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
            <Users className="h-4 w-4" />
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
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
                  Student No
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Name
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Email
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Grade Level
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Section
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
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Loading students...
                  </td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No students found.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student, index) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {student.student_no}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-green-950">
                        {formatFullName(student)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {student.email || '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {student.grade_level}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {student.section}
                    </td>
                    <td className="px-4 py-4">
                      {student.is_active ? (
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
                          onClick={() => openEditModal(student)}
                          className="rounded-xl bg-yellow-50 p-2 text-yellow-700 transition hover:bg-yellow-100"
                          title="Edit student"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {student.is_active ? (
                          <button
                            onClick={() => handleDeactivate(student)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Deactivate student"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(student)}
                            className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                            title="Reactivate student"
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
                    {editingStudent ? 'Update Record' : 'New Student'}
                  </p>
                  <h2 className="text-2xl font-bold text-green-900">
                    {editingStudent ? 'Edit Student' : 'Add Student'}
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Student No *
                    </label>
                    <input
                      name="student_no"
                      value={form.student_no}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      First Name *
                    </label>
                    <input
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Middle Name
                    </label>
                    <input
                      name="middle_name"
                      value={form.middle_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Last Name *
                    </label>
                    <input
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Suffix
                    </label>
                    <input
                      name="suffix"
                      value={form.suffix}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Grade Level *
                    </label>
                    <select
                      name="grade_level"
                      value={form.grade_level}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                    >
                      <option value="Grade 11">Grade 11</option>
                      <option value="Grade 12">Grade 12</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Section *
                    </label>
                    <input
                      name="section"
                      value={form.section}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      required
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
                    disabled={saving}
                    className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editingStudent
                        ? 'Updating...'
                        : 'Saving...'
                      : editingStudent
                      ? 'Update Student'
                      : 'Save Student'}
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