
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  FolderTree,
  BookOpen,
  CalendarRange,
  School,
  ShieldCheck,
  FileSpreadsheet,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const PORTAL_NAME = 'STUDENT PORTAL'
const LOGO_PATH = '/logo.jpg'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Enroll Students', href: '/admin/enroll', icon: UserPlus },
  { label: 'Manage Students', href: '/admin/students', icon: Users },
  { label: 'Manage Teachers', href: '/admin/teachers', icon: GraduationCap },
  { label: 'Manage Subjects', href: '/admin/subjects', icon: BookOpen },
  { label: 'Manage Classes', href: '/admin/classes', icon: School },
  { label: 'Manage Sections', href: '/admin/sections', icon: FolderTree },
  { label: 'School Years', href: '/admin/school-years', icon: CalendarRange },
  { label: 'Grading Control', href: '/admin/grading-control', icon: ShieldCheck },
  { label: 'Grades', href: '/admin/grades', icon: FileSpreadsheet },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
]

type AdminSidebarProps = {
  fullName: string
  email: string
  role: string
}

export default function AdminSidebar({
  fullName,
  email,
  role,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const closeMenu = () => setOpen(false)

  const handleLogout = async () => {
    if (loggingOut) return

    setLoggingOut(true)

    try {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  const isActiveRoute = (href: string) => {
    if (href === '/admin') {
      return pathname === href
    }

    return pathname === href || pathname.startsWith(`${href}/`)
  }

  useEffect(() => {
    closeMenu()
  }, [pathname])

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400 bg-white shadow-lg shadow-cyan-950/30 ${
          compact ? 'h-9 w-9' : 'h-10 w-10'
        }`}
      >
        <Image
          src={LOGO_PATH}
          width={compact ? 28 : 32}
          height={compact ? 28 : 32}
          alt={`${PORTAL_NAME} logo`}
          className="object-contain"
          priority
        />
      </div>

      <div className="min-w-0">
        <p
          className={`truncate font-bold tracking-wide text-white ${
            compact ? 'text-xs sm:text-sm' : 'text-sm xl:text-base'
          }`}
        >
          {PORTAL_NAME}
        </p>

        <p className="text-[10px] font-medium text-cyan-300 sm:text-[11px]">
          Admin Panel
        </p>
      </div>
    </div>
  )

  const AccountCard = () => (
    <div className="mt-3 rounded-xl border border-cyan-400/10 bg-white/[0.06] p-2.5 shadow-inner shadow-black/10">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
        Account
      </p>

      <p className="truncate text-sm font-semibold text-white">
        {fullName}
      </p>

      <p className="truncate text-[11px] text-slate-300">
        {email}
      </p>

      <span className="mt-2 inline-block rounded-full bg-gradient-to-r from-blue-900 to-cyan-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
        {role}
      </span>
    </div>
  )

  const NavigationLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = isActiveRoute(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={mobile ? closeMenu : undefined}
            aria-current={active ? 'page' : undefined}
            className={`group flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2.5 transition duration-200 ${
              active
                ? 'bg-gradient-to-r from-blue-900/90 to-cyan-700/80 text-white shadow-md shadow-slate-950/20 ring-1 ring-cyan-300/20'
                : 'text-slate-200 hover:bg-white/[0.07] hover:text-cyan-300'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition ${
                active
                  ? 'text-cyan-200'
                  : 'text-slate-400 group-hover:text-cyan-300'
              }`}
            />

            <span
              className={`truncate text-[13px] xl:text-sm ${
                active ? 'font-semibold' : 'font-medium'
              }`}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )

  const LogoutButton = ({ mobile = false }: { mobile?: boolean }) => (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-slate-200 transition hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        mobile ? 'py-3' : 'py-2.5'
      }`}
    >
      <LogOut className="h-4 w-4 shrink-0 text-cyan-300 transition group-hover:text-red-300" />

      <span className="truncate text-[13px] font-medium xl:text-sm">
        {loggingOut ? 'Signing out...' : 'Logout'}
      </span>
    </button>
  )

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-cyan-400/15 bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-950 px-3 text-white shadow-lg shadow-slate-950/20 lg:hidden">
        <Brand compact />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-cyan-300 transition hover:bg-white/10 hover:text-white active:scale-95"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-admin-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Overlay */}
      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-[240px] shrink-0 border-r border-cyan-400/15 bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950 text-white shadow-xl shadow-slate-950/20 lg:sticky lg:top-0 lg:flex lg:flex-col xl:w-[252px]">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-cyan-400/15 px-3 py-4">
            <Brand />
            <AccountCard />
          </div>

          <div className="border-b border-cyan-400/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
              Navigation
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            <NavigationLinks />
          </nav>

          <div className="border-t border-cyan-400/15 p-2">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        id="mobile-admin-sidebar"
        className={`fixed inset-y-0 right-0 z-50 w-[82vw] min-w-[220px] max-w-[280px] border-l border-cyan-400/15 bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-y-auto overscroll-contain">
          <div className="border-b border-cyan-400/15 px-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <Brand compact />

              <button
                type="button"
                onClick={closeMenu}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-cyan-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <AccountCard />
          </div>

          <div className="border-b border-cyan-400/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
              Navigation
            </p>
          </div>

          <nav className="px-2 py-2">
            <NavigationLinks mobile />
          </nav>

          <div className="mt-auto border-t border-cyan-400/15 p-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <LogoutButton mobile />
          </div>
        </div>
      </aside>
    </>
  )
}
