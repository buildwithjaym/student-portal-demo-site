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

type GradingWindow = {
  id: string
  school_year: string
  semester: Semester
  grading_period: GradingPeriod
  is_open: boolean
  is_locked: boolean
  opened_by: string | null
  locked_by: string | null
  opened_at: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

const GRADING_PERIODS_BY_SEMESTER: Record<Semester, GradingPeriod[]> = {
  '1st Semester': ['1st', '2nd'],
  '2nd Semester': ['3rd', '4th'],
}

export default function GradingControlPage() {
  const [schoolYear, setSchoolYear] = useState('')
  const [semester, setSemester] = useState<Semester>('1st Semester')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [windows, setWindows] = useState<GradingWindow[]>([])
  const [hasActiveSchoolYear, setHasActiveSchoolYear] = useState(true)

  const visiblePeriods = GRADING_PERIODS_BY_SEMESTER[semester]

  const windowMap = useMemo(() => {
    return visiblePeriods.reduce<Record<string, GradingWindow | null>>((acc, period) => {
      acc[period] = windows.find((w) => w.grading_period === period) ?? null
      return acc
    }, {})
  }, [windows, visiblePeriods])

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw new Error(error.message)
    return user?.id ?? null
  }

  const loadActiveSchoolYear = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      toast.error(error.message)
      setHasActiveSchoolYear(false)
      setSchoolYear('')
      return null
    }

    if (!data) {
      setHasActiveSchoolYear(false)
      setSchoolYear('')
      return null
    }

    setHasActiveSchoolYear(true)
    setSchoolYear((data as AcademicYear).school_year)
    return data as AcademicYear
  }

  const loadWindows = async (activeSchoolYear?: string) => {
    const sy = activeSchoolYear ?? schoolYear

    if (!sy) {
      setWindows([])
      return
    }

    const { data, error } = await supabase
      .from('grading_windows')
      .select('*')
      .eq('school_year', sy)
      .eq('semester', semester)
      .in('grading_period', visiblePeriods)
      .order('grading_period', { ascending: true })

    if (error) {
      toast.error(error.message)
      setWindows([])
      return
    }

    setWindows((data as GradingWindow[]) || [])
  }

  const initialize = async () => {
    setLoading(true)
    const activeYear = await loadActiveSchoolYear()

    if (activeYear?.school_year) {
      await loadWindows(activeYear.school_year)
    } else {
      setWindows([])
    }

    setLoading(false)
  }

  useEffect(() => {
    initialize()
  }, [semester])

  const handleToggleOpen = async (gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      toast.error('No active school year found.')
      return
    }

    const actionKey = `open-${gradingPeriod}`
    setSavingKey(actionKey)

    try {
      const userId = await getCurrentUserId()
      const existing = windowMap[gradingPeriod]

      if (existing?.is_locked) {
        toast.error(`The ${gradingPeriod} grading period is locked.`)
        return
      }

      if (existing) {
        const nextOpenState = !existing.is_open

        const { error } = await supabase
          .from('grading_windows')
          .update({
            is_open: nextOpenState,
            opened_by: nextOpenState ? userId : existing.opened_by,
            opened_at: nextOpenState ? new Date().toISOString() : existing.opened_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) throw error

        toast.success(
          `${gradingPeriod} grading ${nextOpenState ? 'opened' : 'closed'} successfully.`
        )
      } else {
        const { error } = await supabase.from('grading_windows').insert({
          school_year: schoolYear,
          semester,
          grading_period: gradingPeriod,
          is_open: true,
          is_locked: false,
          opened_by: userId,
          opened_at: new Date().toISOString(),
        })

        if (error) throw error

        toast.success(`${gradingPeriod} grading opened successfully.`)
      }

      await loadWindows(schoolYear)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update grading status.')
    } finally {
      setSavingKey(null)
    }
  }

  const handleToggleLock = async (gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      toast.error('No active school year found.')
      return
    }

    const actionKey = `lock-${gradingPeriod}`
    setSavingKey(actionKey)

    try {
      const userId = await getCurrentUserId()
      const existing = windowMap[gradingPeriod]

      if (existing) {
        const nextLockedState = !existing.is_locked

        const { error } = await supabase
          .from('grading_windows')
          .update({
            is_locked: nextLockedState,
            locked_by: nextLockedState ? userId : null,
            locked_at: nextLockedState ? new Date().toISOString() : null,
            is_open: nextLockedState ? false : existing.is_open,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) throw error

        toast.success(
          `${gradingPeriod} grading ${nextLockedState ? 'locked' : 'unlocked'} successfully.`
        )
      } else {
        const { error } = await supabase.from('grading_windows').insert({
          school_year: schoolYear,
          semester,
          grading_period: gradingPeriod,
          is_open: false,
          is_locked: true,
          locked_by: userId,
          locked_at: new Date().toISOString(),
        })

        if (error) throw error

        toast.success(`${gradingPeriod} grading locked successfully.`)
      }

      await loadWindows(schoolYear)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update lock status.')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2"
      >
        <p className="text-sm font-medium text-yellow-600">Administration</p>
        <h1 className="text-3xl font-bold text-green-900">Grading Control</h1>
        <p className="text-gray-600">
          Open, close, and lock grading per grading period for the active school year.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Active School Year
            </label>
            <input
              value={schoolYear || 'No active school year'}
              readOnly
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-700 outline-none"
            />
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
        </div>

        {!hasActiveSchoolYear ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            No active school year found. Please set one active school year first.
          </div>
        ) : loading ? (
          <div className="mt-6 rounded-xl bg-green-50 p-5 text-gray-500">
            Loading grading windows...
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {visiblePeriods.map((period) => {
              const item = windowMap[period]
              const isOpen = item?.is_open ?? false
              const isLocked = item?.is_locked ?? false
              const openSaving = savingKey === `open-${period}`
              const lockSaving = savingKey === `lock-${period}`

              return (
                <div
                  key={period}
                  className="rounded-2xl border border-green-100 bg-green-50 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Grading Period</p>
                      <h2 className="text-xl font-bold text-green-900">
                        {period} Grading Period
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isOpen
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isLocked
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isLocked ? 'Locked' : 'Unlocked'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        <p>
                          Opened At:{' '}
                          {item?.opened_at
                            ? new Date(item.opened_at).toLocaleString()
                            : '—'}
                        </p>
                        <p>
                          Locked At:{' '}
                          {item?.locked_at
                            ? new Date(item.locked_at).toLocaleString()
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => handleToggleOpen(period)}
                        disabled={openSaving || lockSaving || isLocked}
                        className="rounded-xl bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:opacity-60"
                      >
                        {openSaving
                          ? 'Saving...'
                          : isOpen
                          ? 'Close Grading'
                          : 'Open Grading'}
                      </button>

                      <button
                        onClick={() => handleToggleLock(period)}
                        disabled={openSaving || lockSaving}
                        className={`rounded-xl px-5 py-3 font-semibold text-white transition disabled:opacity-60 ${
                          isLocked
                            ? 'bg-blue-700 hover:bg-blue-800'
                            : 'bg-red-700 hover:bg-red-800'
                        }`}
                      >
                        {lockSaving ? 'Saving...' : isLocked ? 'Unlock' : 'Lock'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}