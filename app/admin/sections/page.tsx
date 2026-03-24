'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Pencil, Trash2, FolderTree } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Section = {
  id: string
  section_name: string
  grade_level: 'Grade 11' | 'Grade 12'
  strand: string | null
  is_active: boolean
  created_at: string
}

type SectionForm = {
  section_name: string
  grade_level: 'Grade 11' | 'Grade 12'
  strand: string
  is_active: boolean
}

const initialForm: SectionForm = {
  section_name: '',
  grade_level: 'Grade 11',
  strand: '',
  is_active: true,
}

export default function SectionsPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [form, setForm] = useState<SectionForm>(initialForm)
  const [currentPage, setCurrentPage] = useState(1)

  const pageSize = 8

  const fetchSections = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setSections([])
    } else {
      setSections((data ?? []) as Section[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchSections()
  }, [])

  const filteredSections = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (!keyword) return sections

    return sections.filter((section) => {
      return (
        section.section_name.toLowerCase().includes(keyword) ||
        section.grade_level.toLowerCase().includes(keyword) ||
        (section.strand ?? '').toLowerCase().includes(keyword)
      )
    })
  }, [sections, search])

  const totalPages = Math.max(1, Math.ceil(filteredSections.length / pageSize))

  const paginatedSections = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredSections.slice(start, start + pageSize)
  }, [filteredSections, currentPage])

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
    setEditingSection(null)
  }

  const openAddModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (section: Section) => {
    setEditingSection(section)
    setForm({
      section_name: section.section_name,
      grade_level: section.grade_level,
      strand: section.strand ?? '',
      is_active: section.is_active,
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
      section_name: form.section_name.trim(),
      grade_level: form.grade_level,
      strand: form.strand.trim() || null,
      is_active: form.is_active,
    }

    if (!payload.section_name || !payload.grade_level) {
      toast.error('Please complete the required fields.')
      setSaving(false)
      return
    }

    if (editingSection) {
      const { error } = await supabase
        .from('sections')
        .update(payload)
        .eq('id', editingSection.id)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Section updated successfully.')
        closeModal()
        fetchSections()
      }
    } else {
      const { error } = await supabase.from('sections').insert(payload)

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Section added successfully.')
        closeModal()
        fetchSections()
      }
    }

    setSaving(false)
  }

  const handleDeactivate = async (section: Section) => {
    const confirmed = window.confirm(
      `Set section "${section.section_name}" as inactive?`
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('sections')
      .update({ is_active: false })
      .eq('id', section.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Section set to inactive.')
      fetchSections()
    }
  }

  const handleReactivate = async (section: Section) => {
    const { error } = await supabase
      .from('sections')
      .update({ is_active: true })
      .eq('id', section.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Section reactivated.')
      fetchSections()
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
          <h1 className="text-3xl font-bold text-green-900">Sections</h1>
          <p className="mt-1 text-gray-600">
            Manage sections by grade level, strand, and active status.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-900"
        >
          <Plus className="h-5 w-5" />
          Add Section
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
              placeholder="Search by section, grade level, or strand"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
            <FolderTree className="h-4 w-4" />
            {filteredSections.length} section{filteredSections.length !== 1 ? 's' : ''}
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
                  Section Name
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Grade Level
                </th>
                <th className="px-4 py-4 text-left text-sm font-semibold text-green-900">
                  Strand
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
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    Loading sections...
                  </td>
                </tr>
              ) : paginatedSections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    No sections found.
                  </td>
                </tr>
              ) : (
                paginatedSections.map((section, index) => (
                  <motion.tr
                    key={section.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="border-t border-gray-100"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold text-green-950">
                        {section.section_name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {section.grade_level}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {section.strand || '—'}
                    </td>
                    <td className="px-4 py-4">
                      {section.is_active ? (
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
                          onClick={() => openEditModal(section)}
                          className="rounded-xl bg-yellow-50 p-2 text-yellow-700 transition hover:bg-yellow-100"
                          title="Edit section"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        {section.is_active ? (
                          <button
                            onClick={() => handleDeactivate(section)}
                            className="rounded-xl bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                            title="Deactivate section"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(section)}
                            className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                            title="Reactivate section"
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
              className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600">
                    {editingSection ? 'Update Record' : 'New Section'}
                  </p>
                  <h2 className="text-2xl font-bold text-green-900">
                    {editingSection ? 'Edit Section' : 'Add Section'}
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
                      Section Name *
                    </label>
                    <input
                      name="section_name"
                      value={form.section_name}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      placeholder="e.g. STEM-A"
                      required
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
                      Strand
                    </label>
                    <input
                      name="strand"
                      value={form.strand}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
                      placeholder="e.g. STEM, HUMSS, ABM"
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
                      ? editingSection
                        ? 'Updating...'
                        : 'Saving...'
                      : editingSection
                      ? 'Update Section'
                      : 'Save Section'}
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