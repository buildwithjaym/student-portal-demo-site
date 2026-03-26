'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StudentSidebar from '@/components/student/student-sidebar'
import { supabaseStudent } from '@/lib/supabase-student'

type ProfileRow = {
  role: 'admin' | 'teacher' | 'student'
  is_active: boolean
  must_change_password: boolean
}

type StudentRow = {
  id: string
  profile_id: string | null
  student_no: string
  email: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  grade_level: string
  section: string
}

export default function StudentLayout({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState<StudentRow | null>(null)

  useEffect(() => {
    let mounted = true

    const checkStudentAccess = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabaseStudent.auth.getUser()

        if (userError || !user) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileError } = await supabaseStudent
          .from('profiles')
          .select('role, is_active, must_change_password')
          .eq('id', user.id)
          .single()

        if (profileError || !profile) {
          router.replace('/login')
          return
        }

        const typedProfile = profile as ProfileRow

        if (!typedProfile.is_active) {
          await supabaseStudent.auth.signOut()
          router.replace('/login')
          return
        }

        if (typedProfile.must_change_password) {
          router.replace('/change-password')
          return
        }

        if (typedProfile.role !== 'student') {
          if (typedProfile.role === 'admin') {
            router.replace('/admin')
            return
          }

          if (typedProfile.role === 'teacher') {
            router.replace('/teacher')
            return
          }

          router.replace('/login')
          return
        }

        const { data: studentData, error: studentError } = await supabaseStudent
          .from('students')
          .select(
            `
            id,
            profile_id,
            student_no,
            email,
            first_name,
            middle_name,
            last_name,
            suffix,
            grade_level,
            section
          `
          )
          .eq('profile_id', user.id)
          .single()

        if (studentError || !studentData) {
          router.replace('/login')
          return
        }

        if (mounted) {
          setStudent(studentData as StudentRow)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkStudentAccess()

    return () => {
      mounted = false
    }
  }, [router])

  const studentName = student
    ? `${student.first_name} ${student.last_name}`
    : 'Student'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f2]">
        <StudentSidebar studentName="Student" studentNo={null} section={null} />
        <main className="min-h-screen md:pl-[290px]">
          <div className="px-4 pb-8 pt-20 md:px-8 md:pt-8">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
                <p className="font-medium text-green-900">
                  Loading student portal...
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f7f2]">
      <StudentSidebar
        studentName={studentName}
        studentNo={student?.student_no ?? null}
        section={student?.section ?? null}
      />

      <main className="min-h-screen md:pl-[290px]">
        <div className="px-4 pb-8 pt-20 md:px-8 md:pt-8">{children}</div>
      </main>
    </div>
  )
}