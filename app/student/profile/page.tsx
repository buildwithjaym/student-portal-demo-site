'use client'

import { useEffect, useState } from 'react'
import { supabaseStudent } from '@/lib/supabase-student'

type StudentRow = {
  id: string
  student_no: string
  email: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
  gender: string | null
}

export default function StudentProfilePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [student, setStudent] = useState<StudentRow | null>(null)

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      try {
        setLoading(true)
        setError('')

        const {
          data: { user },
        } = await supabaseStudent.auth.getUser()

        if (!user) throw new Error('No authenticated user found.')

        const { data, error } = await supabaseStudent
          .from('students')
          .select(
            `
            id,
            student_no,
            email,
            first_name,
            middle_name,
            last_name,
            suffix,
            grade_level,
            section,
            gender
          `
          )
          .eq('profile_id', user.id)
          .single()

        if (error || !data) throw new Error('Failed to load profile.')
        if (mounted) setStudent(data as StudentRow)
      } catch (err: any) {
        if (mounted) setError(err.message || 'Failed to load profile.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="font-medium text-green-900">Loading profile...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Error</p>
        <p className="mt-2 text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-green-900 via-green-800 to-green-700 px-6 py-7 text-white shadow-lg">
        <h1 className="text-2xl font-extrabold md:text-3xl">My Profile</h1>
        <p className="mt-2 text-sm text-green-100 md:text-base">
          View your personal and academic information.
        </p>
      </section>

      <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard label="Student No." value={student?.student_no || '—'} />
          <InfoCard label="First Name" value={student?.first_name || '—'} />
          <InfoCard label="Middle Name" value={student?.middle_name || '—'} />
          <InfoCard label="Last Name" value={student?.last_name || '—'} />
          <InfoCard label="Suffix" value={student?.suffix || '—'} />
          <InfoCard label="Email" value={student?.email || '—'} />
          <InfoCard label="Gender" value={student?.gender || '—'} />
          <InfoCard label="Grade Level" value={student?.grade_level || '—'} />
          <InfoCard label="Section" value={student?.section || '—'} />
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50/40 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-green-950">{value}</p>
    </div>
  )
}