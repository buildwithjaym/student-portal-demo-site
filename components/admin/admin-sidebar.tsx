'use client'

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[265px] shrink-0 flex-col border-r border-yellow-400/15 bg-green-950 text-white">
      <div className="border-b border-yellow-400/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400 bg-white shadow-sm">
            <Image
              src="/logo.jpg"
              alt="Qorban Portal Logo"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-wide text-white">
              QORBAN PORTAL
            </h1>
            <p className="text-xs font-medium text-yellow-300">Admin Panel</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-green-800 bg-green-900/70 p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300">
            Account
          </p>

          <div className="mt-2 space-y-0.5">
            <p className="truncate text-sm font-semibold text-white">{fullName}</p>
            <p className="truncate text-xs text-green-100">{email}</p>
          </div>

          <div className="mt-2">
            <span className="inline-flex rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-950">
              {role}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-yellow-400/10 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-300/90">
          Navigation
        </p>
      </div>

      <nav className="flex-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 border-l-4 px-5 py-2.5 transition-all ${
                isActive
                  ? 'border-yellow-400 bg-green-900 text-yellow-300'
                  : 'border-transparent text-white hover:border-yellow-400 hover:bg-green-900/60 hover:text-yellow-300'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${
                  isActive ? 'text-yellow-300' : 'text-yellow-300/90'
                }`}
              />
              <span className="truncate text-[15px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-yellow-400/10">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 border-l-4 border-transparent px-5 py-3 text-left text-white transition hover:border-yellow-400 hover:bg-green-900/60 hover:text-yellow-300"
        >
          <LogOut className="h-[26px] w-[18px] shrink-0 text-yellow-300" />
          <span className="text-[15px] font-medium">Logout</span>
        </button>
      </div>
    </aside>
  )
}