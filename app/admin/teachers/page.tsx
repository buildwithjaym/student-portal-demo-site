'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Pencil, Trash2, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'

type Teacher = {
  id: string
  profile_id?: string | null
  teacher_no: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  email: string | null
  contact: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

type TeacherForm = {
  teacher_no: string
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  email: string
  contact: string
  address: string
  is_active: boolean
}

const initialForm: TeacherForm = {
  teacher_no: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  email: '',
  contact: '',
  address: '',
  is_active: true,
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [form, setForm] = useState<TeacherForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 8

  const fetchTeachers = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setTeachers([])
    } else {
      setTeachers((data ?? []) as Teacher[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchTeachers()
  }, [])

  const filteredTeachers = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return teachers

    return teachers.filter((teacher) => {
      const fullName = formatFullName(teacher).toLowerCase()

      return (
        teacher.teacher_no.toLowerCase().includes(keyword) ||
        fullName.includes(keyword) ||
        (teacher.email ?? '').toLowerCase().includes(keyword) ||
        (teacher.contact ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [teachers, search])

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / pageSize))

  const paginatedTeachers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTeachers.slice(start, start + pageSize)
  }, [filteredTeachers, currentPage])

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
    setEditingTeacher(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setForm({
      teacher_no: teacher.teacher_no,
      first_name: teacher.first_name,
      middle_name: teacher.middle_name ?? '',
      last_name: teacher.last_name,
      suffix: teacher.suffix ?? '',
      email: teacher.email ?? '',
      contact: teacher.contact ?? '',
      address:teacher.address ?? '',
      is_active: teacher.is_active,
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
      teacher_no: form.teacher_no.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      suffix: form.suffix.trim() || null,
      email: form.email.trim().toLowerCase() || null,
      contact: form.contact.trim() || null,
      address: form.address.trim() || null,
      is_active: form.is_active,
    }

    if (!payload.teacher_no || !payload.first_name || !payload.last_name) {
      toast.error('Please complete the required fields.')
      setSaving(false)
      return
    }

    if (!editingTeacher && !payload.email) {
      toast.error('Email is required when creating a teacher login account.')
      setSaving(false)
      return
    }

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update(payload)
        .eq('id', editingTeacher.id)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Teacher updated successfully.')
        closeModal()
        fetchTeachers()
      }
    } else {
      const response = await fetch('/api/admin/teachers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        toast.error(result.error || 'Failed to create teacher.')
      } else {
        toast.success(
          `Teacher added successfully. Temporary password is: ${result.temporary_password}`
        )
        closeModal()
        fetchTeachers()
      }
    }

    setSaving(false)
  }

  const handleDeactivate = async (teacher: Teacher) => {
    const confirmed = window.confirm(
      `Set ${formatFullName(teacher)} as inactive?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('teachers')
      .update({ is_active: false })
      .eq('id', teacher.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Teacher set to inactive.')
      fetchTeachers()
    }
  }

  const handleReactivate = async (teacher: Teacher) => {
    const { error } = await supabase
      .from('teachers')
      .update({ is_active: true })
      .eq('id', teacher.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Teacher reactivated.')
      fetchTeachers()
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
          <p className="text-xs font-medium text-cyan-600 sm:text-sm">Administration</p>
          <h1 className="text-3xl font-bold text-cyan-900">Teachers</h1>
          <p className="mt-1 text-gray-600">
            Manage teacher records and create teacher login accounts.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-800 px-4 py-3 font-semibold text-white transition hover:bg-cyan-900"
        >
          <Plus className="h-5 w-5" />
          Add Teacher
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by teacher no, name, email, or contact"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
            <GraduationCap className="h-4 w-4" />
            {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-cyan-50">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Teacher No
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Name
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Email
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Contact
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Address
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-cyan-900">
                  Status
                </th>
                <th className="px-4 py-4 text-right text-sm font-semibold text-cyan-900">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    Loading teachers...
                  </td>
                </tr>
              ) : paginatedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No teachers found.
                  </td>
                </tr>
              ) : (
                paginatedTeachers.map((teacher, index) => (
                  <motion.tr
                    key={teacher.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {teacher.teacher_no}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-cyan-950">
                        {formatFullName(teacher)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {teacher.email || '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {teacher.contact || '—'}
                    </td>
                     <td className="px-4 py-4 text-sm text-gray-600">
                      {teacher.address || '—'}
                    </td>
                    <td className="px-4 py-4">
                      {teacher.is_active ? (
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
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
                          onClick={() => openEditModal(teacher)}
                          className="rounded-xl bg-yellow-50 p-2 text-yellow-700 transition hover:bg-yellow-100"
                          title="Edit teacher"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {teacher.is_active ? (
                          <button
                            onClick={() => handleDeactivate(teacher)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Deactivate teacher"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(teacher)}
                            className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
                            title="Reactivate teacher"
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
                    {editingTeacher ? 'Update Record' : 'New Teacher'}
                  </p>
                  <h2 className="text-2xl font-bold text-cyan-900">
                    {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
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
                      Teacher No *
                    </label>
                    <input
                      name="teacher_no"
                      value={form.teacher_no}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email {!editingTeacher ? '*' : ''}
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      required={!editingTeacher}
                      disabled={saving}
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
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      required
                      disabled={saving}
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
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      disabled={saving}
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
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      required
                      disabled={saving}
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
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Contact
                    </label>
                    <input
                      name="contact"
                      type="text"
                      value={form.contact}
                      onChange={handleChange}
                      placeholder="09xxxxxxxxx"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      disabled={saving}
                    />
                  </div>
                  <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <input
                      name="address"
                      type="text"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="Enter address"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      disabled={saving}
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
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      disabled={saving}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>

                {!editingTeacher && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    A login account will be created automatically. The teacher&apos;s temporary
                    password will be their teacher number.
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 transition hover:bg-gray-50"
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-cyan-800 px-5 py-3 font-semibold text-white transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editingTeacher
                        ? 'Updating...'
                        : 'Saving...'
                      : editingTeacher
                        ? 'Update Teacher'
                        : 'Save Teacher'}
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