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
]

export default function AdminSidebar({ fullName, email, role }: any) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  useEffect(() => closeMenu(), [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="lg:hidden h-16 flex items-center justify-between px-4 bg-green-950 text-white border-b border-yellow-400/10">
        <span className="font-bold text-sm">QORBAN PORTAL</span>

        <button onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5 text-yellow-300" />
        </button>
      </div>

      {/* OVERLAY */}
      <div
        onClick={closeMenu}
        className={`fixed inset-0 bg-black/50 z-40 transition ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } lg:hidden`}
      />

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-[270px] bg-green-950 text-white border-r border-yellow-400/10 transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky`}
      >
        <div className="flex h-full flex-col">
          {/* HEADER */}
          <div className="px-4 py-4 border-b border-yellow-400/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.jpg"
                  width={36}
                  height={36}
                  alt="logo"
                  className="rounded-full border border-yellow-400"
                />
                <div>
                  <p className="text-sm font-bold">QORBAN PORTAL</p>
                  <p className="text-[10px] text-yellow-300">Admin Panel</p>
                </div>
              </div>

              <button onClick={closeMenu} className="lg:hidden">
                <X className="h-5 w-5 text-yellow-300" />
              </button>
            </div>

            {/* ACCOUNT */}
            <div className="mt-3 bg-green-900/60 rounded-xl p-3">
              <p className="text-[10px] text-yellow-300 uppercase">Account</p>
              <p className="text-sm font-semibold truncate">{fullName}</p>
              <p className="text-xs text-green-200 truncate">{email}</p>

              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-yellow-400 text-green-950 rounded-full font-bold">
                {role}
              </span>
            </div>
          </div>

          {/* NAV */}
          <nav className="flex-1 px-2 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                    active
                      ? 'bg-green-900 text-yellow-300'
                      : 'hover:bg-green-900/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* LOGOUT */}
          <div className="p-2 border-t border-yellow-400/10">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-900/60"
            >
              <LogOut className="h-4 w-4 text-yellow-300" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}