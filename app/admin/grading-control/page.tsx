'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function getPeriodOrder(period: GradingPeriod) {
  if (period === '1st') return 1
  if (period === '2nd') return 2
  if (period === '3rd') return 3
  return 4
}

export default function GradingControlPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [schoolYear, setSchoolYear] = useState('')
  const [semester, setSemester] = useState<Semester>('1st Semester')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [windows, setWindows] = useState<GradingWindow[]>([])

  const initializedRef = useRef(false)

  const visiblePeriods = GRADING_PERIODS_BY_SEMESTER[semester]

  const windowMap = useMemo(() => {
    return visiblePeriods.reduce<Record<GradingPeriod, GradingWindow | null>>(
      (acc, period) => {
        acc[period] = windows.find((w) => w.grading_period === period) ?? null
        return acc
      },
      {
        '1st': null,
        '2nd': null,
        '3rd': null,
        '4th': null,
      }
    )
  }, [windows, visiblePeriods])

  const getCurrentUserId = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) throw new Error(error.message)
    return user?.id ?? null
  }

  const loadAcademicYears = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, school_year, is_active')
      .order('school_year', { ascending: false })

    if (error) {
      toast.error(error.message)
      setAcademicYears([])
      setSchoolYear('')
      return null
    }

    const rows = (data ?? []) as AcademicYear[]
    setAcademicYears(rows)

    if (rows.length === 0) {
      setSchoolYear('')
      return null
    }

    const activeYear = rows.find((row) => row.is_active)
    const selectedYear = activeYear?.school_year || rows[0].school_year

    setSchoolYear((prev) => prev || selectedYear)
    return selectedYear
  }

  const detectCurrentOpenSemester = async (selectedSchoolYear: string) => {
    const { data, error } = await supabase
      .from('grading_windows')
      .select('semester, grading_period, is_open, is_locked')
      .eq('school_year', selectedSchoolYear)
      .eq('is_open', true)
      .eq('is_locked', false)

    if (error) {
      toast.error(error.message)
      return null
    }

    const openWindows = (data ?? []) as Pick<
      GradingWindow,
      'semester' | 'grading_period' | 'is_open' | 'is_locked'
    >[]

    if (openWindows.length === 0) {
      return null
    }

    const prioritized = openWindows
      .slice()
      .sort(
        (a, b) => getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period)
      )[0]

    return prioritized.semester
  }

  const loadWindows = async (
    selectedSchoolYear?: string,
    selectedSemester?: Semester
  ) => {
    const sy = selectedSchoolYear ?? schoolYear
    const sem = selectedSemester ?? semester

    if (!sy) {
      setWindows([])
      return
    }

    const periods = GRADING_PERIODS_BY_SEMESTER[sem]

    const { data, error } = await supabase
      .from('grading_windows')
      .select('*')
      .eq('school_year', sy)
      .eq('semester', sem)
      .in('grading_period', periods)

    if (error) {
      toast.error(error.message)
      setWindows([])
      return
    }

    const sorted = ((data ?? []) as GradingWindow[]).slice().sort((a, b) => {
      return getPeriodOrder(a.grading_period) - getPeriodOrder(b.grading_period)
    })

    setWindows(sorted)
  }

  const initialize = async () => {
    setLoading(true)
    try {
      const { data: years, error: yErr } = await supabase
        .from('academic_years')
        .select('id, school_year, is_active')
        .order('school_year', { ascending: false })

      if (yErr) throw yErr

      const list = (years ?? []) as AcademicYear[]
      setAcademicYears(list)

      const active = list.find(y => y.is_active)?.school_year || list[0]?.school_year
      if (!active) return

      setSchoolYear(active)

      const { data: all, error: wErr } = await supabase
        .from('grading_windows')
        .select('*')
        .eq('school_year', active)

      if (wErr) throw wErr

      const allWindows = (all ?? []) as GradingWindow[]
      setWindows(allWindows)

      const open = allWindows.find(w => w.is_open && !w.is_locked)
      const resolved: Semester = open?.semester || '1st Semester'

      setSemester(resolved)
      initializedRef.current = true
    } catch (e: any) {
      toast.error(e.message || 'Initialization failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initialize()
  }, [])

  useEffect(() => {
    if (!initializedRef.current || !schoolYear) return

    const run = async () => {
      setLoading(true)
      try {
        await loadWindows(schoolYear, semester)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [schoolYear, semester])

  const handleToggleOpen = async (gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      toast.error('Please select a school year first.')
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
            opened_by: nextOpenState ? userId : null,
            opened_at: nextOpenState ? new Date().toISOString() : null,
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

      await loadWindows(schoolYear, semester)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update grading status.')
    } finally {
      setSavingKey(null)
    }
  }

  const handleToggleLock = async (gradingPeriod: GradingPeriod) => {
    if (!schoolYear) {
      toast.error('Please select a school year first.')
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

      await loadWindows(schoolYear, semester)
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
        <p className="text-xs font-medium text-cyan-600 sm:text-sm">Administration</p>
        <h1 className="text-3xl font-bold text-cyan-900">Grading Control</h1>
        <p className="text-slate-600">
          Open, close, and lock grading per grading period for the selected school year.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Academic Year
            </label>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            >
              <option value="">Select academic year</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.school_year}>
                  {year.school_year}
                  {year.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as Semester)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-200"
            >
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>
        </div>

        {!schoolYear ? (
          <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-800">
            No academic year available. Please create an academic year first.
          </div>
        ) : loading ? (
          <div className="mt-6 rounded-xl bg-cyan-50 p-5 text-slate-500">
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
                  className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Grading Period</p>
                      <h2 className="text-xl font-bold text-cyan-900">
                        {period} Grading Period
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isOpen
                              ? 'bg-cyan-100 text-cyan-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isOpen ? 'Open' : 'Closed'}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isLocked
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-cyan-100 text-cyan-700'
                          }`}
                        >
                          {isLocked ? 'Locked' : 'Unlocked'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-slate-600">
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
                        className="rounded-xl bg-cyan-800 px-5 py-3 font-semibold text-white transition hover:bg-cyan-900 disabled:opacity-60"
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
                            ? 'bg-cyan-700 hover:bg-cyan-800'
                            : 'bg-rose-700 hover:bg-rose-800'
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