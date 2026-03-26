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

  const closeMenu = () => setOpen(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  useEffect(() => {
    closeMenu()
  }, [pathname])

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-yellow-400/10 bg-green-950 px-3 text-white lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-white shadow-sm">
            <Image
              src="/logo.jpg"
              width={28}
              height={28}
              alt="Qorban Portal Logo"
              className="object-contain"
              priority
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-bold tracking-wide sm:text-sm">
              QORBAN PORTAL
            </p>
            <p className="text-[10px] text-yellow-300">Admin Panel</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-yellow-300 transition hover:bg-green-900/70 active:scale-95"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-admin-sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Overlay */}
      <div
        onClick={closeMenu}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Desktop Sidebar */}
      <aside className="hidden h-screen w-[240px] shrink-0 border-r border-yellow-400/10 bg-green-950 text-white lg:sticky lg:top-0 lg:flex lg:flex-col xl:w-[252px]">
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-yellow-400/10 px-3 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-white shadow-sm">
                <Image
                  src="/logo.jpg"
                  width={32}
                  height={32}
                  alt="Qorban Portal Logo"
                  className="object-contain"
                  priority
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold tracking-wide xl:text-base">
                  QORBAN PORTAL
                </p>
                <p className="text-[11px] text-yellow-300">Admin Panel</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-green-900/60 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-yellow-300">
                Account
              </p>
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-[11px] text-green-200">{email}</p>

              <span className="mt-2 inline-block rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-green-950">
                {role}
              </span>
            </div>
          </div>

          <div className="border-b border-yellow-400/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/90">
              Navigation
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2.5 transition ${
                    active
                      ? 'bg-green-900 text-yellow-300'
                      : 'text-white hover:bg-green-900/60 hover:text-yellow-300'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-[13px] font-medium xl:text-sm">
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-yellow-400/10 p-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-green-900/60 hover:text-yellow-300"
            >
              <LogOut className="h-4 w-4 shrink-0 text-yellow-300" />
              <span className="truncate text-[13px] font-medium xl:text-sm">
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside
        id="mobile-admin-sidebar"
        className={`fixed inset-y-0 right-0 z-50 w-[82vw] max-w-[280px] min-w-[220px] border-l border-yellow-400/10 bg-green-950 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-y-auto overscroll-contain">
          <div className="border-b border-yellow-400/10 px-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-white shadow-sm">
                  <Image
                    src="/logo.jpg"
                    width={28}
                    height={28}
                    alt="Qorban Portal Logo"
                    className="object-contain"
                    priority
                  />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-bold tracking-wide sm:text-sm">
                    QORBAN PORTAL
                  </p>
                  <p className="text-[10px] text-yellow-300">Admin Panel</p>
                </div>
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
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-[11px] text-green-200">{email}</p>

              <span className="mt-2 inline-block rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold uppercase text-green-950">
                {role}
              </span>
            </div>
          </div>

          <div className="border-b border-yellow-400/10 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/90">
              Navigation
            </p>
          </div>

          <nav className="px-2 py-2">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`)

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
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-3 text-left transition hover:bg-green-900/60 hover:text-yellow-300"
            >
              <LogOut className="h-4 w-4 shrink-0 text-yellow-300" />
              <span className="truncate text-[13px] font-medium sm:text-sm">
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}