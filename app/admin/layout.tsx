'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster } from 'sonner'
import AdminSidebar from '@/components/admin/admin-sidebar'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  email: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  role: 'admin' | 'teacher' | 'student'
}

function formatFullName(profile: Profile) {
  return [
    profile.first_name,
    profile.middle_name,
    profile.last_name,
    profile.suffix,
  ]
    .filter(Boolean)
    .join(' ')
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    const loadAdminProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, middle_name, last_name, suffix, role')
        .eq('id', user.id)
        .single()

      if (error || !data || data.role !== 'admin') {
        router.replace('/login')
        return
      }

      setProfile(data)
      setLoading(false)
    }

    loadAdminProfile()
  }, [router])

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-green-900">
        Loading admin panel...
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar
          fullName={formatFullName(profile)}
          email={profile.email}
          role={profile.role}
        />

        <main className="min-w-0 flex-1 overflow-y-auto bg-gradient-to-br from-yellow-50 via-white to-green-50 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          classNames: {
            toast: 'rounded-2xl',
            title: 'font-semibold',
            description: 'text-sm',
          },
        }}
      />
    </>
  )
}