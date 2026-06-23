'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin' | 'teacher' | 'student' | null

type ProfileRow = {
  role: UserRole
  is_active: boolean
  must_change_password: boolean
}

export default function LoginPage() {
  const router = useRouter()
  const timeoutHandledRef = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const finishChecking = () => {
      if (!isMounted) return
      setCheckingSession(false)
    }

    const getProfileFromSession = async (): Promise<ProfileRow | null> => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) return null

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active, must_change_password')
        .eq('id', user.id)
        .single()

      if (profileError || !profile?.role) return null

      return profile as ProfileRow
    }

    const redirectByProfile = async (profile: ProfileRow) => {
      if (!profile.is_active) {
        await supabase.auth.signOut()
        setError('Your account is inactive. Please contact the administrator.')
        finishChecking()
        return
      }

      if (profile.must_change_password) {
        router.replace('/change-password')
        return
      }

      if (profile.role === 'admin') {
        router.replace('/admin')
        return
      }

      if (profile.role === 'teacher') {
        router.replace('/teacher')
        return
      }

      if (profile.role === 'student') {
        router.replace('/student')
        return
      }

      finishChecking()
    }

    const checkSession = async () => {
      timeoutHandledRef.current = false

      const timeoutId = window.setTimeout(() => {
        timeoutHandledRef.current = true
        finishChecking()
      }, 1000)

      try {
        const profile = await getProfileFromSession()
        window.clearTimeout(timeoutId)

        if (timeoutHandledRef.current) return

        if (!profile) {
          finishChecking()
          return
        }

        await redirectByProfile(profile)
      } catch {
        window.clearTimeout(timeoutId)

        if (timeoutHandledRef.current) return
        finishChecking()
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const user = data.user

    if (!user) {
      setError('Login failed. Please try again.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, must_change_password')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      setError('Profile not found.')
      setLoading(false)
      return
    }

    if (!profile.is_active) {
      await supabase.auth.signOut()
      setError('Your account is inactive. Please contact the administrator.')
      setLoading(false)
      return
    }

    if (profile.must_change_password) {
      router.replace('/change-password')
      setLoading(false)
      return
    }

    if (profile.role === 'admin') {
      router.replace('/admin')
    } else if (profile.role === 'teacher') {
      router.replace('/teacher')
    } else if (profile.role === 'student') {
      router.replace('/student')
    } else {
      setError('Invalid account role.')
    }

    setLoading(false)
  }


if (checkingSession) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm font-medium">Checking session...</p>
      </div>
    </div>
  )
}

return (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 px-4 py-8">
    <div className="w-full max-w-md rounded-3xl border border-cyan-400/20 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-cyan-500 bg-white shadow-lg">
          <Image
            src="/logo.jpg"
            alt="Company Student Portal Logo"
            width={84}
            height={84}
            className="object-contain"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold tracking-wide text-slate-900">
          STUDENT PORTAL
        </h1>

        <p className="mt-2 text-sm font-semibold text-cyan-700">
          Academic Management System
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Secure access to grades, report cards, attendance, and report cards.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email Address
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={loading}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>

            <Link
              href="/login/forgot-password"
              className="text-sm font-medium text-blue-800 transition hover:text-blue-950 hover:underline"
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-200"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-medium text-blue-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-blue-900 to-cyan-600 py-3 font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4 text-center">
        <p className="text-xs text-slate-500">
          Student Portal • Academic Management System
        </p>
      </div>
    </div>
  </div>
)

}