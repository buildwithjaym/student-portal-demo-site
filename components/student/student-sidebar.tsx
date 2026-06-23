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
import Image from 'next/image'

type StudentSidebarProps = {
  studentName?: string
  studentNo?: string | null
  section?: string | null
}

const LOGO_PATH = '/logo.jpg'

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

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabaseStudent.auth.signOut()
    router.replace('/login')
    setLoggingOut(false)
  }

  const isActive = (href: string) =>
    href === '/student' ? pathname === '/student' : pathname.startsWith(href)

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950 text-white">

      {/* BRAND */}
      <div className="border-b border-cyan-400/15 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-cyan-400 bg-white shadow-lg">
            <Image src={LOGO_PATH} alt="logo" width={40} height={40} />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-white">STUDENT PORTAL</p>
            <p className="text-[11px] text-cyan-300">Student Panel</p>
          </div>
        </div>
      </div>

      {/* INFO */}
      <div className="border-b border-cyan-400/15 p-3">
        <div className="rounded-xl border border-cyan-400/10 bg-white/[0.06] p-3">
          <p className="text-[10px] uppercase tracking-wide text-cyan-300">
            Account
          </p>

          <p className="text-sm font-semibold">{studentName || 'Student'}</p>
          <p className="text-xs text-slate-300">No: {studentNo || '—'}</p>
          <p className="text-xs text-slate-300">Section: {section || '—'}</p>
        </div>
      </div>

      {/* NAV */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-2 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
          Navigation
        </p>

        <div className="mt-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  active
                    ? 'bg-gradient-to-r from-blue-900/90 to-cyan-700/80 text-white ring-1 ring-cyan-300/20'
                    : 'text-slate-200 hover:bg-white/10 hover:text-cyan-300'
                )}
              >
                <Icon
                  className={clsx(
                    'h-4 w-4',
                    active ? 'text-cyan-200' : 'text-slate-400'
                  )}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* LOGOUT */}
      <div className="border-t border-cyan-400/15 p-3">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-slate-200 hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut className="h-4 w-4 text-cyan-300" />
          <span className="text-sm">
            {loggingOut ? 'Logging out...' : 'Logout'}
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* DESKTOP */}
      <aside className="hidden h-screen w-[240px] lg:fixed lg:left-0 lg:top-0 lg:flex">
        <SidebarContent />
      </aside>

      {/* MOBILE HEADER */}
      <header className="flex h-14 items-center justify-between border-b border-cyan-400/15 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-3 text-white lg:hidden">
        <h2 className="text-sm font-semibold">Student Portal</h2>

        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-cyan-300 hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* OVERLAY */}
      <div
        onClick={() => setOpen(false)}
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

     
      <aside
        className={clsx(
          'fixed right-0 top-0 z-50 h-full w-[82%] max-w-[320px] transform bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950 text-white shadow-2xl transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <SidebarContent mobile />
      </aside>
    </>
  )
}