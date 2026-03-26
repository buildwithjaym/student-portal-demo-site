'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  User,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import clsx from 'clsx'
import { supabaseStudent } from '@/lib/supabase-student'

type StudentSidebarProps = {
  studentName?: string
  studentNo?: string | null
  section?: string | null
}

const navItems = [
  { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
  { label: 'My Grades', href: '/student/grades', icon: GraduationCap },
  { label: 'My Subjects', href: '/student/subjects', icon: BookOpen },
  { label: 'My Profile', href: '/student/profile', icon: User },
]

export default function StudentSidebar({
  studentName,
  studentNo,
  section,
}: StudentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabaseStudent.auth.signOut()
      router.replace('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-green-900 text-white shadow-lg md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 flex h-screen w-[290px] flex-col bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-green-800 px-5 py-5">
          <div>
            <h1 className="text-xl font-extrabold text-white">STUDENT PORTAL</h1>
            <p className="text-sm font-semibold text-yellow-400">Qorban Portal</p>
          </div>

          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 hover:bg-green-800 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-2xl bg-green-800/60 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-yellow-400">
              Student
            </p>
            <p className="text-base font-bold">{studentName || 'Student'}</p>
            <p className="mt-2 text-sm text-green-100">
              Student No: {studentNo || '—'}
            </p>
            <p className="text-sm text-green-100">Section: {section || '—'}</p>
          </div>
        </div>

        <div className="px-3">
          <p className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Navigation
          </p>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href ||
                (item.href !== '/student' && pathname.startsWith(`${item.href}/`))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'flex min-h-[56px] items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition',
                    isActive
                      ? 'bg-green-700 text-yellow-300'
                      : 'text-white hover:bg-green-800 hover:text-yellow-300'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-green-800 p-4">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-xl bg-green-800 px-4 py-3 font-semibold text-white transition hover:bg-green-700 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>
    </>
  )
}