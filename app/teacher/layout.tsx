'use client'

import { ReactNode, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type TeacherInfo = {
  fullName?: string
  teacherNo?: string
}

function TeacherShell({
  children,
  pathname,
  mobileOpen,
  setMobileOpen,
  onLogout,
  teacher,
}: {
  children: ReactNode
  pathname: string
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
  onLogout: () => Promise<void>
  teacher?: TeacherInfo | null
}) {
  const navItems = useMemo(
    () => [
      { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/teacher/classes', label: 'My Classes', icon: BookOpen },
      { href: '/teacher/grades', label: 'Grade Encoding', icon: GraduationCap },
      { href: '/teacher/reports', label: 'Reports', icon: FileText },
      { href: '/teacher/profile', label: 'Profile', icon: UserCircle2 },
    ],
    []
  )

  const isActive = (href: string) => {
    if (href === '/teacher') return pathname === '/teacher'
    return pathname.startsWith(href)
  }

  const pageTitle =
    pathname === '/teacher'
      ? 'Dashboard'
      : pathname.startsWith('/teacher/classes')
        ? 'My Classes'
        : pathname.startsWith('/teacher/grades')
          ? 'Grade Encoding'
          : pathname.startsWith('/teacher/reports')
            ? 'Reports'
            : pathname.startsWith('/teacher/profile')
              ? 'Profile'
              : 'Teacher Portal'

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-gradient-to-b from-green-950 via-green-900 to-green-800 text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-300">
          Qorban Portal
        </p>
        <h2 className="mt-1 text-xl font-bold">Teacher Portal</h2>
        <p className="mt-1 text-sm text-green-100/80">
          Online Grade Management System
        </p>
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-green-100/70">
          Signed in as
        </p>
        <p className="mt-1 font-semibold">{teacher?.fullName ?? 'Teacher'}</p>
        <p className="text-sm text-green-100/80">
          {teacher?.teacherNo ? `Teacher No: ${teacher.teacherNo}` : 'Teacher account'}
        </p>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? 'bg-white text-green-900 shadow-lg'
                  : 'text-green-50 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-100 transition hover:bg-red-500/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-green-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 overflow-hidden shadow-xl lg:block">
        <SidebarContent />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-green-100 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-green-200 text-green-900 transition hover:bg-green-50 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-xs font-medium text-yellow-700">Teacher Portal</p>
                <h1 className="text-base font-semibold text-green-950">{pageTitle}</h1>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-green-950">
                {teacher?.fullName ?? 'Teacher'}
              </p>
              <p className="text-xs text-gray-500">
                {teacher?.teacherNo ? `#${teacher.teacherNo}` : ''}
              </p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-80 max-w-[88vw] overflow-hidden shadow-2xl lg:hidden"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 bg-green-950 px-4 text-white">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">
                    Qorban Portal
                  </p>
                  <h2 className="text-lg font-bold">Teacher Menu</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-white transition hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <TeacherShell
      pathname={pathname}
      mobileOpen={mobileOpen}
      setMobileOpen={setMobileOpen}
      onLogout={handleLogout}
      teacher={null}
    >
      {children}
    </TeacherShell>
  )
}