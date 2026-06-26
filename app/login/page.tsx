'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type DemoRole = 'admin' | 'teacher' | 'student'

type ProfileRow = {
  role: string | null
  is_active: boolean | null
  must_change_password: boolean | null
}

type DemoAccount = {
  title: string
  description: string
  email: string
  password: string
  initial: string
  badgeClass: string
  cardClass: string
}

const ROLE_ROUTES: Record<DemoRole, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
}

const DEMO_ROLES: DemoRole[] = ['admin', 'teacher', 'student']

const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  admin: {
    title: 'Admin',
    description: 'Manage users, classes, records, and system settings.',
    email: 'school_admin@gmail.com',
    password: 'school_admin',
    initial: 'A',
    badgeClass: 'bg-violet-100 text-violet-700',
    cardClass:
      'hover:border-violet-400 hover:bg-violet-50 focus-visible:ring-violet-500',
  },
  teacher: {
    title: 'Teacher',
    description: 'Manage students, grades, attendance, and reports.',
    email: 'teacher_elle@gmail.com',
    password: '2025-Q0099',
    initial: 'T',
    badgeClass: 'bg-cyan-100 text-cyan-700',
    cardClass:
      'hover:border-cyan-400 hover:bg-cyan-50 focus-visible:ring-cyan-500',
  },
  student: {
    title: 'Student',
    description: 'View grades, attendance, reports, and school records.',
    email: 'juandelacruz8@gmail.com',
    password: '2026-Q000011',
    initial: 'S',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    cardClass:
      'hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-emerald-500',
  },
}
const resolveUserContext = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  let teacher = null

  if (profile.role === 'teacher') {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('profile_id', userId)
      .maybeSingle()

    teacher = data
  }

  return { profile, teacher }
}
export default function LoginPage() {
  const router = useRouter()

  const mountedRef = useRef(true)
  const loginLockRef = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const [demoLoadingRole, setDemoLoadingRole] = useState<DemoRole | null>(null)
  const [error, setError] = useState('')

  /* =========================
     FIXED SESSION CHECK (SAFE)
     ========================= */
  useEffect(() => {
    mountedRef.current = true

    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!mountedRef.current) return

        if (!user) {
          setCheckingSession(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active, must_change_password')
          .eq('id', user.id)
          .maybeSingle()
        const context = await resolveUserContext(user.id)

if (context?.profile?.role === 'teacher' && !context.teacher) {
  await supabase.auth.signOut()
  setCheckingSession(false)
  return
}
        if (!mountedRef.current) return

        if (!profile || profile.is_active !== true) {
          await supabase.auth.signOut()
          setCheckingSession(false)
          return
        }

        const role = profile.role?.toLowerCase() as DemoRole

        if (!ROLE_ROUTES[role]) {
          await supabase.auth.signOut()
          setCheckingSession(false)
          return
        }

        if (profile.must_change_password) {
          router.replace('/change-password')
          return
        }

        setCheckingSession(false)
        router.replace(ROLE_ROUTES[role])

      } catch {
        if (mountedRef.current) setCheckingSession(false)
      }
    }

    checkSession()

    return () => {
      mountedRef.current = false
    }
  }, [router])

  /* =========================
     AUTH FUNCTION FIXED
     ========================= */
  const authenticate = async (
    loginEmail: string,
    loginPassword: string,
  ) => {
    if (loginLockRef.current) return

    loginLockRef.current = true
    setLoading(true)
    setError('')

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        })

      if (error || !data.user) throw new Error('Login failed')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active, must_change_password')
        .eq('id', data.user.id)
        .maybeSingle()
      
      if (!profile || profile.is_active !== true) {
        await supabase.auth.signOut()
        throw new Error('Inactive or missing profile')
      }

      const role = profile.role?.toLowerCase() as DemoRole

      if (!ROLE_ROUTES[role]) {
        await supabase.auth.signOut()
        throw new Error('Invalid role')
      }

      if (profile.must_change_password) {
        router.replace('/change-password')
        return
      }

      router.replace(ROLE_ROUTES[role])

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login error')
    } finally {
      setLoading(false)
      loginLockRef.current = false
    }
  }

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await authenticate(email, password)
  }

  const handleDemoLogin = async (role: DemoRole) => {
    const acc = DEMO_ACCOUNTS[role]
    setDemoLoadingRole(role)
    await authenticate(acc.email, acc.password)
  }

  const openDemoModal = () => {
    setError('')
    setDemoModalOpen(true)
  }

  const closeDemoModal = () => {
    if (loading) return
    setDemoModalOpen(false)
    setError('')
  }
  if (checkingSession) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 px-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm font-medium">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <main className="login-shell flex h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 p-2 sm:p-4">
        <div className="login-card w-full max-w-md rounded-2xl border border-cyan-400/20 bg-white/95 p-4 shadow-2xl backdrop-blur-sm sm:rounded-3xl sm:p-6">
          <div className="login-grid">
            <section className="login-brand mb-5 text-center sm:mb-6">
              <div className="portal-logo mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-cyan-500 bg-white shadow-lg sm:h-24 sm:w-24">
                <Image
                  src="/logo.jpg"
                  alt="Company Student Portal Logo"
                  width={84}
                  height={84}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>

              <h1 className="text-2xl font-bold tracking-wide text-slate-900 sm:text-3xl">
                STUDENT PORTAL
              </h1>

              <p className="brand-subtitle mt-1 text-xs font-semibold text-cyan-700 sm:mt-2 sm:text-sm">
                Academic Management System
              </p>

              <p className="brand-description mx-auto mt-1 max-w-sm text-[11px] leading-4 text-slate-500 sm:mt-2 sm:text-xs">
                Secure access to grades, attendance, report cards, and academic
                records.
              </p>
            </section>

            <section>
              {error && !demoModalOpen && (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mb-4 sm:px-4 sm:py-3 sm:text-sm"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleLogin}
                className="form-stack space-y-3 sm:space-y-4"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="field-label mb-1 block text-xs font-medium text-slate-700 sm:text-sm"
                  >
                    Email Address
                  </label>

                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                    className="field-input w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-3"
                  />
                </div>

                <div>
                  <div className="field-label mb-1 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-medium text-slate-700 sm:text-sm"
                    >
                      Password
                    </label>

                    <Link
                      href="/login/forgot-password"
                      className="text-xs font-medium text-blue-800 transition hover:text-blue-950 hover:underline sm:text-sm"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      className="field-input w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-20 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-100 sm:py-3"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-blue-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-900 to-cyan-600 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
                >
                  {loading && !demoLoadingRole ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:text-xs">
                    or
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={openDemoModal}
                  disabled={loading}
                  className="w-full rounded-xl border border-cyan-600 bg-cyan-50 py-2.5 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
                >
                  Try Demo Account
                </button>
              </form>

              <div className="footer-note mt-4 border-t border-slate-200 pt-3 text-center sm:mt-5">
                <p className="text-[10px] text-slate-500 sm:text-xs">
                  Student Portal • Academic Management System
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Demo role modal */}
{demoModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

    {/* backdrop */}
    <button
      onClick={closeDemoModal}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
    />

    {/* modal */}
    <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">

      {/* header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-cyan-700">
            DEMO MODE
          </p>

          <h2 className="text-xl font-bold text-slate-900">
            Choose a role to explore
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Each role shows a different dashboard experience
          </p>
        </div>

        <button
          onClick={closeDemoModal}
          className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center"
        >
          ×
        </button>
      </div>

      {/* role cards */}
      <div className="grid gap-3 sm:grid-cols-3">

        {DEMO_ROLES.map((role) => {
          const isLoading = demoLoadingRole === role

          const styles =
            role === 'admin'
              ? 'hover:border-violet-400 hover:bg-violet-50'
              : role === 'teacher'
              ? 'hover:border-cyan-400 hover:bg-cyan-50'
              : 'hover:border-emerald-400 hover:bg-emerald-50'

          return (
            <button
              key={role}
              onClick={() => handleDemoLogin(role)}
              disabled={loading}
              className={`group relative overflow-hidden rounded-2xl border border-slate-200 p-5 text-left transition ${styles}`}
            >

              {/* glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-white/0 via-white/40 to-white/0" />

              <div className="relative">

                {/* icon */}
                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold
                  ${
                    role === 'admin'
                      ? 'bg-violet-100 text-violet-700'
                      : role === 'teacher'
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {role.charAt(0).toUpperCase()}
                </div>

                {/* title */}
                <h3 className="font-semibold text-slate-900 capitalize">
                  {role}
                </h3>

                <p className="text-[11px] text-slate-500 mt-1">
                  Click to enter dashboard
                </p>

                {/* action */}
                <div className="mt-3 text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition">
                  {isLoading ? 'Loading...' : 'Continue →'}
                </div>

              </div>
            </button>
          )
        })}

      </div>

      {/* footer */}
      <p className="mt-5 text-center text-[11px] text-slate-400">
        Demo environment only. No real credentials shown or required.
      </p>

    </div>
  </div>
)}

      <style jsx>{`
        .login-card {
          max-height: calc(100dvh - 1rem);
        }

        .demo-dialog {
          max-height: calc(100dvh - 1.5rem);
        }

        @media (max-height: 650px) and (max-width: 639px) {
          .login-card {
            padding: 0.75rem;
          }

          .login-brand {
            margin-bottom: 0.75rem;
          }

          .portal-logo {
            width: 3.5rem;
            height: 3.5rem;
            margin-bottom: 0.5rem;
            border-width: 3px;
          }

          .brand-description {
            display: none;
          }

          .form-stack {
            display: flex;
            flex-direction: column;
            gap: 0.55rem;
          }

          .field-input {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }

          .footer-note {
            display: none;
          }

          .demo-dialog {
            padding: 0.75rem;
          }

          .demo-credentials,
          .modal-footer-note {
            display: none;
          }
        }

        @media (max-height: 680px) and (min-width: 640px) {
          .login-card {
            max-width: 52rem;
            padding: 1rem 1.25rem;
          }

          .login-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 0.85fr)
              minmax(0, 1.15fr);
            align-items: center;
            gap: 1.5rem;
          }

          .login-brand {
            margin-bottom: 0;
          }

          .portal-logo {
            width: 4.5rem;
            height: 4.5rem;
            margin-bottom: 0.75rem;
          }

          .brand-description,
          .footer-note {
            display: none;
          }

          .form-stack {
            display: flex;
            flex-direction: column;
            gap: 0.65rem;
          }

          .field-input {
            padding-top: 0.55rem;
            padding-bottom: 0.55rem;
          }

          .demo-dialog {
            padding: 1rem;
          }

          .demo-role-grid {
            gap: 0.65rem;
          }
        }

        @media (max-height: 520px) and (min-width: 640px) {
          .brand-subtitle,
          .demo-credentials,
          .modal-footer-note {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
