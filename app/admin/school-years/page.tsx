'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  CalendarRange,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type AcademicYear = {
  id: string
  school_year: string
  is_active: boolean
  created_at: string
}

type AcademicYearForm = {
  school_year: string
  is_active: boolean
}

const initialForm: AcademicYearForm = {
  school_year: '',
  is_active: false,
}

export default function SchoolYearsPage() {
  const [schoolYears, setSchoolYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null)
  const [form, setForm] = useState<AcademicYearForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 8

  const fetchSchoolYears = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('academic_years')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setSchoolYears([])
    } else {
      setSchoolYears((data ?? []) as AcademicYear[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchSchoolYears()
  }, [])

  const filteredSchoolYears = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return schoolYears

    return schoolYears.filter((item) =>
      item.school_year.toLowerCase().includes(keyword)
    )
  }, [schoolYears, search])

  const totalPages = Math.max(1, Math.ceil(filteredSchoolYears.length / pageSize))

  const paginatedSchoolYears = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredSchoolYears.slice(start, start + pageSize)
  }, [filteredSchoolYears, currentPage])

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
    setEditingYear(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (item: AcademicYear) => {
    setEditingYear(item)
    setForm({
      school_year: item.school_year,
      is_active: item.is_active,
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

  const deactivateOtherYears = async (exceptId?: string) => {
    let query = supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('is_active', true)

    if (exceptId) {
      query = query.neq('id', exceptId)
    }

    const { error } = await query
    return error
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      school_year: form.school_year.trim(),
      is_active: form.is_active,
    }

    if (!payload.school_year) {
      toast.error('Please enter a school year.')
      setSaving(false)
      return
    }

    if (payload.is_active) {
      const deactivateError = await deactivateOtherYears(editingYear?.id)
      if (deactivateError) {
        toast.error(deactivateError.message)
        setSaving(false)
        return
      }
    }

    if (editingYear) {
      const { error } = await supabase
        .from('academic_years')
        .update(payload)
        .eq('id', editingYear.id)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('School year updated successfully.')
        closeModal()
        fetchSchoolYears()
      }
    } else {
      const { error } = await supabase.from('academic_years').insert(payload)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('School year added successfully.')
        closeModal()
        fetchSchoolYears()
      }
    }

    setSaving(false)
  }

  const handleSetActive = async (item: AcademicYear) => {
    const deactivateError = await deactivateOtherYears(item.id)
    if (deactivateError) {
      toast.error(deactivateError.message)
      return
    }

    const { error } = await supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${item.school_year} is now the active school year.`)
      fetchSchoolYears()
    }
  }

  const handleDeactivate = async (item: AcademicYear) => {
    const confirmed = window.confirm(
      `Set school year "${item.school_year}" as inactive?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('School year set to inactive.')
      fetchSchoolYears()
    }
  }

  const handleDelete = async (item: AcademicYear) => {
    const confirmed = window.confirm(
      `Delete school year "${item.school_year}"?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('academic_years')
      .delete()
      .eq('id', item.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('School year deleted successfully.')
      fetchSchoolYears()
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
          <p className="text-sm font-medium text-cyan-600">Administration</p>
          <h1 className="text-3xl font-bold text-cyan-900">School Years</h1>
          <p className="mt-1 text-slate-600">
            Manage school years and set the currently active academic year.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-cyan-800 px-4 py-3 font-semibold text-white transition hover:bg-cyan-900"
        >
          <Plus className="h-5 w-5" />
          Add School Year
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by school year"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-800">
            <CalendarRange className="h-4 w-4" />
            {filteredSchoolYears.length} school year
            {filteredSchoolYears.length !== 1 ? 's' : ''}
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
                  School Year
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
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    Loading school years...
                  </td>
                </tr>
              ) : paginatedSchoolYears.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    No school years found.
                  </td>
                </tr>
              ) : (
                paginatedSchoolYears.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-cyan-950">
                        {item.school_year}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {item.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                          <CheckCircle2 className="h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!item.is_active && (
                          <button
                            onClick={() => handleSetActive(item)}
                            className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
                            title="Set active"
                          >
                            Set Active
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(item)}
                          className="rounded-xl bg-cyan-50 p-2 text-cyan-700 transition hover:bg-cyan-100"
                          title="Edit school year"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {item.is_active ? (
                          <button
                            onClick={() => handleDeactivate(item)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Deactivate school year"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete(item)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Delete school year"
                          >
                            <Trash2 className="h-4 w-4" />
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

        <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-cyan-600">
                    {editingYear ? 'Update Record' : 'New School Year'}
                  </p>
                  <h2 className="text-2xl font-bold text-cyan-900">
                    {editingYear ? 'Edit School Year' : 'Add School Year'}
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      School Year *
                    </label>
                    <input
                      name="school_year"
                      value={form.school_year}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                      placeholder="e.g. 2025-2026"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Status
                    </label>
                    <select
                      name="is_active"
                      value={String(form.is_active)}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
                    >
                      <option value="false">Inactive</option>
                      <option value="true">Active</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl bg-cyan-50 p-4 text-sm text-cyan-800">
                  Setting a school year as active will automatically set other school years to inactive.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-cyan-800 px-5 py-3 font-semibold text-white transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editingYear
                        ? 'Updating...'
                        : 'Saving...'
                      : editingYear
                      ? 'Update School Year'
                      : 'Save School Year'}
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