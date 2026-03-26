'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
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

export default function StudentSidebar({
  studentName,
  studentNo,
  section,
}: StudentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
      { label: 'My Grades', href: '/student/grades', icon: GraduationCap },
      { label: 'My Subjects', href: '/student/subjects', icon: BookOpen },
      { label: 'My Profile', href: '/student/profile', icon: User },
    ],
    []
  )

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      await supabaseStudent.auth.signOut()
      router.replace('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/student') return pathname === '/student'
    return pathname.startsWith(href)
  }

  const pageTitle =
    pathname === '/student'
      ? 'Dashboard'
      : pathname.startsWith('/student/grades')
        ? 'My Grades'
        : pathname.startsWith('/student/subjects')
          ? 'My Subjects'
          : pathname.startsWith('/student/profile')
            ? 'My Profile'
            : 'Student Portal'

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[290px] overflow-hidden shadow-2xl md:block">
        <div className="flex h-full flex-col bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
              Qorban Portal
            </p>
            <h1 className="mt-1 text-xl font-extrabold">Student Portal</h1>
            <p className="mt-1 text-sm text-green-100/80">
              Online Grade Management System
            </p>
          </div>

          <div className="border-b border-white/10 p-4">
            <div className="rounded-2xl bg-white/10 p-4">
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

          <div className="flex-1 px-3 py-4">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
              Navigation
            </p>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex min-h-[56px] items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition',
                      active
                        ? 'bg-white text-green-900 shadow-lg'
                        : 'text-white hover:bg-white/10 hover:text-yellow-300'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="border-t border-white/10 p-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-5 w-5" />
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-green-100 bg-white/95 backdrop-blur md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-green-200 text-green-900 transition hover:bg-green-50"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-xs font-medium text-yellow-700">Student Portal</p>
              <h2 className="text-base font-semibold text-green-950">{pageTitle}</h2>
            </div>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />

          <aside
            className={clsx(
              'fixed inset-y-0 left-0 z-50 flex h-screen w-[290px] max-w-[88vw] flex-col overflow-hidden bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white shadow-2xl transition-transform duration-300 md:hidden',
              open ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
                  Qorban Portal
                </p>
                <h2 className="mt-1 text-xl font-extrabold">Student Menu</h2>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 transition hover:bg-white/10"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="border-b border-white/10 p-4">
              <div className="rounded-2xl bg-white/10 p-4">
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

            <div className="flex-1 px-3 py-4">
              <p className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
                Navigation
              </p>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={clsx(
                        'flex min-h-[56px] items-center gap-3 rounded-2xl px-4 py-3 text-base font-semibold transition',
                        active
                          ? 'bg-white text-green-900 shadow-lg'
                          : 'text-white hover:bg-white/10 hover:text-yellow-300'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="border-t border-white/10 p-4">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-5 w-5" />
                {loggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}