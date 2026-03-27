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
      }`}
    >
      <div className="border-b border-yellow-400/10 px-3 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-wide text-yellow-300 xl:text-base">
            QORBAN PORTAL
          </p>
          <p className="text-[11px] text-white/80">Teacher Portal</p>
          <p className="mt-1 text-[11px] text-green-200">
            Online Grade Management System
          </p>
        </div>

        <div className="mt-3 rounded-xl bg-green-900/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-yellow-300">
            Account
          </p>
          <p className="truncate text-sm font-semibold">
            {teacher?.fullName ?? 'Teacher'}
          </p>
          <p className="truncate text-[11px] text-green-200">
            {teacher?.teacherNo ? `Teacher No: ${teacher.teacherNo}` : 'Teacher account'}
          </p>

          <span className="mt-2 inline-block rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-green-950">
            Teacher
          </span>
        </div>
      </div>

      <div className="border-b border-yellow-400/10 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/90">
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
                    ? 'bg-green-900 text-yellow-300'
                    : 'text-white hover:bg-green-900/60 hover:text-yellow-300'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-[13px] font-medium sm:text-sm">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-yellow-400/10 p-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left text-white transition hover:bg-green-900/60 hover:text-yellow-300"
        >
          <LogOut className="h-4 w-4 shrink-0 text-yellow-300" />
          <span className="truncate text-[13px] font-medium sm:text-sm">
            Logout
          </span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-green-50">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-yellow-400/10 bg-green-950 px-3 text-white lg:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold tracking-wide sm:text-sm">
            QORBAN PORTAL
          </p>
          <p className="text-[10px] text-yellow-300">{pageTitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-yellow-300 transition hover:bg-green-900/70 active:scale-95"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-teacher-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <div className="flex min-h-[calc(100vh-56px)] lg:min-h-screen">
        <aside className="hidden h-screen w-[240px] shrink-0 border-r border-yellow-400/10 bg-green-950 text-white lg:sticky lg:top-0 lg:flex lg:flex-col xl:w-[252px]">
          <SidebarInner />
        </aside>

        <aside
          id="mobile-teacher-sidebar"
          className={`fixed inset-y-0 right-0 z-50 w-[82vw] max-w-[280px] min-w-[220px] border-l border-yellow-400/10 bg-green-950 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-y-auto overscroll-contain">
            <div className="border-b border-yellow-400/10 px-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold tracking-wide sm:text-sm">
                    QORBAN PORTAL
                  </p>
                  <p className="text-[10px] text-yellow-300">Teacher Portal</p>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-yellow-300 transition hover:bg-green-900/70 active:scale-95"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 rounded-xl bg-green-900/60 p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-yellow-300">
                  Account
                </p>
                <p className="truncate text-sm font-semibold">
                  {teacher?.fullName ?? 'Teacher'}
                </p>
                <p className="truncate text-[11px] text-green-200">
                  {teacher?.teacherNo ? `Teacher No: ${teacher.teacherNo}` : 'Teacher account'}
                </p>

                <span className="mt-2 inline-block rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-green-950">
                  Teacher
                </span>
              </div>
            </div>

            <div className="border-b border-yellow-400/10 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/90">
                Navigation
              </p>
            </div>

            <SidebarInner mobile />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-14 z-20 hidden border-b border-green-100 bg-white/95 backdrop-blur lg:block lg:top-0">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
              <div className="min-w-0">
                <p className="text-xs font-medium text-yellow-700">Teacher Portal</p>
                <h1 className="truncate text-base font-semibold text-green-950">
                  {pageTitle}
                </h1>
              </div>

              <div className="hidden text-right sm:block">
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
      </div>
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