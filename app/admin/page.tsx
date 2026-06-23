'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Users, GraduationCap, BookOpen, School } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatFullName } from '@/lib/name'
import type {
  DashboardStats,
  GradeLevelChartItem,
  TopStudent,
} from '@/lib/dashboard'

type GradeRow = {
  student_id: string
  grade: number
}

type StudentRow = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    totalClasses: 0,
  })

  const [chartData, setChartData] = useState<GradeLevelChartItem[]>([])
  const [topStudents, setTopStudents] = useState<TopStudent[]>([])
  const [error, setError] = useState('')

  const chartWrapperRef = useRef<HTMLDivElement | null>(null)
  const [chartWidth, setChartWidth] = useState(0)
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        setError('')

        const [
          studentsResult,
          teachersResult,
          subjectsResult,
          classesResult,
          gradesResult,
        ] = await Promise.all([
          supabase
            .from('students')
            .select(
              'id, first_name, middle_name, last_name, suffix, grade_level, section',
              { count: 'exact' }
            ),
          supabase.from('teachers').select('id', { count: 'exact' }),
          supabase.from('subjects').select('id', { count: 'exact' }),
          supabase.from('classes').select('id', { count: 'exact' }),
          supabase.from('grades').select('student_id, grade'),
        ])

        if (studentsResult.error) throw studentsResult.error
        if (teachersResult.error) throw teachersResult.error
        if (subjectsResult.error) throw subjectsResult.error
        if (classesResult.error) throw classesResult.error
        if (gradesResult.error) throw gradesResult.error

        const students = (studentsResult.data ?? []) as StudentRow[]
        const grades = (gradesResult.data ?? []) as GradeRow[]

        setStats({
          totalStudents: studentsResult.count ?? 0,
          totalTeachers: teachersResult.count ?? 0,
          totalSubjects: subjectsResult.count ?? 0,
          totalClasses: classesResult.count ?? 0,
        })

        const groupedChart: Record<string, number> = {}

        for (const student of students) {
          groupedChart[student.grade_level] =
            (groupedChart[student.grade_level] ?? 0) + 1
        }

        const chartItems: GradeLevelChartItem[] = Object.entries(
          groupedChart
        ).map(([grade_level, total]) => ({
          grade_level,
          total,
        }))

        setChartData(chartItems)

        const studentMap = new Map<string, StudentRow>()

        for (const student of students) {
          studentMap.set(student.id, student)
        }

        const averageMap = new Map<string, { sum: number; count: number }>()

        for (const row of grades) {
          const current = averageMap.get(row.student_id) ?? {
            sum: 0,
            count: 0,
          }

          current.sum += Number(row.grade)
          current.count += 1

          averageMap.set(row.student_id, current)
        }

        const ranked: TopStudent[] = Array.from(averageMap.entries())
          .map(([studentId, value]) => {
            const student = studentMap.get(studentId)
            if (!student) return null

            return {
              student_id: student.id,
              first_name: student.first_name,
              middle_name: student.middle_name,
              last_name: student.last_name,
              suffix: student.suffix,
              grade_level: student.grade_level,
              section: student.section,
              average: Number((value.sum / value.count).toFixed(2)),
            }
          })
          .filter(Boolean) as TopStudent[]

        const grade11 = ranked
          .filter((s) => s.grade_level === 'Grade 11')
          .sort((a, b) => b.average - a.average)
          .slice(0, 3)

        const grade12 = ranked
          .filter((s) => s.grade_level === 'Grade 12')
          .sort((a, b) => b.average - a.average)
          .slice(0, 3)

        setTopStudents([...grade11, ...grade12])
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  useEffect(() => {
    if (loading) return

    const updateWidth = () => {
      if (!chartWrapperRef.current) return

      const w = chartWrapperRef.current.getBoundingClientRect().width

      if (w > 0) {
        setChartWidth(Math.floor(w))
        setChartReady(true)
      }
    }

    const t = window.setTimeout(updateWidth, 100)

    window.addEventListener('resize', updateWidth)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', updateWidth)
    }
  }, [loading])

  const groupedTopStudents = useMemo(() => {
    return {
      'Grade 11': topStudents.filter((s) => s.grade_level === 'Grade 11'),
      'Grade 12': topStudents.filter((s) => s.grade_level === 'Grade 12'),
    }
  }, [topStudents])

  const statCards = [
    { title: 'Total Students', value: stats.totalStudents, icon: Users },
    { title: 'Total Teachers', value: stats.totalTeachers, icon: GraduationCap },
    { title: 'Total Subjects', value: stats.totalSubjects, icon: BookOpen },
    { title: 'Total Classes', value: stats.totalClasses, icon: School },
  ]

  const chartHeight = 320

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-600">
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* HEADER */}
      <div>
        <p className="text-sm font-medium text-cyan-600">Overview</p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor system performance and academic summary.
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* STATS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon

          return (
            <div
              key={card.title}
              className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.title}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {card.value}
                  </p>
                </div>

                <div className="rounded-2xl bg-cyan-50 p-3">
                  <Icon className="h-5 w-5 text-cyan-600" />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* CHART + TOP STUDENTS */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* CHART */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-4">
            <p className="text-sm font-medium text-cyan-600">
              System Overview
            </p>
            <h2 className="text-xl font-bold text-slate-900">
              Students by Grade Level
            </h2>
          </div>

          <div ref={chartWrapperRef} className="w-full overflow-hidden">
            <div className="flex h-[360px] items-center justify-center">
              {!chartReady || chartWidth <= 0 ? (
                <div className="text-sm text-slate-400">Loading chart...</div>
              ) : (
                <BarChart
                  width={Math.max(chartWidth - 24, 260)}
                  height={chartHeight}
                  data={chartData}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade_level" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="total"
                    radius={[8, 8, 0, 0]}
                    fill="#06b6d4"
                  />
                </BarChart>
              )}
            </div>
          </div>
        </div>

        {/* TOP STUDENTS */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-cyan-600">
            Top Students
          </p>
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            By Grade Level
          </h2>

          <div className="space-y-5">
            {Object.entries(groupedTopStudents).map(([grade, students]) => (
              <div key={grade}>
                <h3 className="mb-2 font-semibold text-slate-700">
                  {grade}
                </h3>

                {students.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-400">
                    No data yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.map((student, i) => (
                      <div
                        key={student.student_id + i}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {formatFullName(student)}
                            </p>
                            <p className="text-sm text-slate-500">
                              {student.section}
                            </p>
                          </div>

                          <div className="rounded-lg bg-cyan-600 px-3 py-1 text-sm font-bold text-white">
                            {student.average.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}