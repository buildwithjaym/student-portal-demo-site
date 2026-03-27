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
      { label: 'Grades', href: '/student/grades', icon: GraduationCap },
      { label: 'Subjects', href: '/student/subjects', icon: BookOpen },
      { label: 'Profile', href: '/student/profile', icon: User },
    ],
    []
  )

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

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

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-green-950 via-green-900 to-green-950 text-white">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-400 sm:text-xs">
              Qorban Portal
            </p>
            <h1 className="mt-1 text-lg font-extrabold sm:text-xl">
              {mobile ? 'Student Menu' : 'Student Portal'}
            </h1>
            {!mobile && (
              <p className="mt-1 text-xs text-green-100/80 sm:text-sm">
                Online Grade Management System
              </p>
            )}
          </div>

          {mobile && (
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-white/10 p-3 sm:p-4">
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-yellow-400 sm:text-xs">
            Student
          </p>
          <p className="truncate text-sm font-bold sm:text-base">
            {studentName || 'Student'}
          </p>
          <p className="mt-2 break-words text-xs text-green-100 sm:text-sm">
            Student No: {studentNo || '—'}
          </p>
          <p className="break-words text-xs text-green-100 sm:text-sm">
            Section: {section || '—'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-[0.25em] text-yellow-400 sm:text-xs">
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
                onClick={() => mobile && setOpen(false)}
                className={clsx(
                  'flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:min-h-[56px] sm:text-base',
                  active
                    ? 'bg-white text-green-900 shadow-lg'
                    : 'text-white hover:bg-white/10 hover:text-yellow-300'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 p-3 sm:p-4">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500/15 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[56px] sm:text-base"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop / Tablet Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-hidden border-r border-white/10 shadow-2xl md:block lg:w-72 xl:w-80">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-20 border-b border-green-100 bg-white/95 backdrop-blur md:hidden">
        <div className="flex min-h-16 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-green-200 text-green-900 transition hover:bg-green-50"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <p className="text-[11px] font-medium text-yellow-700">
                Student Portal
              </p>
              <h2 className="truncate text-sm font-semibold text-green-950">
                {pageTitle}
              </h2>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-40 md:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={clsx(
            'absolute inset-0 bg-black/50 transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0'
          )}
        />

        <aside
          className={clsx(
            'absolute inset-y-0 left-0 z-50 flex h-dvh w-[82vw] max-w-[320px] flex-col overflow-hidden shadow-2xl transition-transform duration-300 xs:w-[78vw] sm:max-w-sm',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Student navigation menu"
        >
          <SidebarContent mobile />
        </aside>
      </div>
    </>
  )
}