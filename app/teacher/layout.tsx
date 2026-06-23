'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import Image from 'next/image'

const LOGO_PATH = '/logo.jpg'

type TeacherInfo = {
  fullName?: string
  teacherNo?: string
}

type TeacherLayoutProps = {
  children: ReactNode
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

  const closeMenu = () => setMobileOpen(false)

  useEffect(() => {
    closeMenu()
  }, [pathname])

  const isActive = (href: string) => {
    if (href === '/teacher') return pathname === '/teacher'
    return pathname === href || pathname.startsWith(`${href}/`)
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

  const SidebarInner = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={`flex h-full flex-col ${
        mobile ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'
      } bg-gradient-to-b from-slate-950 via-cyan-950 to-slate-900 text-white`}
    >
      {/* HEADER */}
      <div className="border-b border-cyan-500/15 px-3 py-4">

        <div className="mb-3 flex items-center gap-2.5">
          <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-cyan-400 bg-white shadow-lg">
            <Image
              src={LOGO_PATH}
              alt="logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white">
              STUDENT PORTAL
            </p>
            <p className="text-[11px] text-cyan-300">Teacher Portal</p>
            <p className="text-[11px] text-slate-300">
              Online Grade Management System
            </p>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="rounded-xl border border-cyan-400/10 bg-white/[0.06] p-2.5 shadow-inner">
          <p className="text-[10px] uppercase tracking-wide text-cyan-300">
            Account
          </p>

          <p className="truncate text-sm font-semibold text-white">
            {teacher?.fullName ?? 'Teacher'}
          </p>

          <p className="truncate text-[11px] text-slate-300">
            {teacher?.teacherNo ? `Teacher No: ${teacher.teacherNo}` : 'Teacher account'}
          </p>

          <span className="mt-2 inline-block rounded-full bg-gradient-to-r from-cyan-700 to-cyan-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Teacher
          </span>
        </div>
      </div>

      {/* NAV */}
      <div className="border-b border-cyan-500/10 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
          Navigation
        </p>
      </div>

      <nav className={`${mobile ? 'px-2 py-2' : 'flex-1 overflow-y-auto px-2 py-2'}`}>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition ${
                  active
                    ? 'bg-cyan-700/60 text-white'
                    : 'text-slate-200 hover:bg-white/[0.07] hover:text-cyan-300'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? 'text-cyan-200' : 'text-slate-400'
                  }`}
                />

                <span className="truncate text-[13px] font-medium sm:text-sm">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* LOGOUT */}
      <div className="mt-auto border-t border-cyan-500/15 p-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left text-slate-200 transition hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="truncate text-[13px] font-medium sm:text-sm">
            Logout
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cyan-50">

      {/* MOBILE HEADER (IMPROVED RESPONSIVE CARD STYLE) */}
      <header className="lg:hidden sticky top-0 z-30 border-b border-cyan-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between">

          <div className="min-w-0">
            <p className="text-xs font-medium text-cyan-600">Overview</p>
            <h1 className="truncate text-lg font-bold text-slate-900">
              {pageTitle}
            </h1>
            <p className="text-[11px] text-slate-500">
              Teacher Portal Dashboard
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 transition active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)] lg:min-h-screen">

        {/* SIDEBAR */}
        <aside className="hidden h-screen w-[240px] shrink-0 border-r border-cyan-500/10 bg-cyan-950 text-white lg:sticky lg:top-0 lg:flex lg:flex-col xl:w-[252px]">
          <SidebarInner />
        </aside>

        {/* CONTENT */}
        <div className="min-w-0 flex-1">
          <main className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>

      </div>

      {/* MOBILE DRAWER */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[82vw] max-w-[280px] min-w-[220px] border-l border-cyan-500/10 bg-cyan-950 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <button
            onClick={closeMenu}
            className="absolute right-3 top-3 rounded-lg p-2 text-cyan-300"
          >
            <X className="h-5 w-5" />
          </button>

          <SidebarInner mobile />
        </div>
      </aside>

      {/* BACKDROP */}
      {mobileOpen && (
        <div
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
    </div>
  )
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    setMobileOpen(false)
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