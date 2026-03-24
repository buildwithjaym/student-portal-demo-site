'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type UserRole = 'admin' | 'teacher' | 'student' | null

export default function LoginPage() {
  const router = useRouter()
  const timeoutHandledRef = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const log = (...args: unknown[]) => {
      console.log('[LoginPage]', ...args)
    }

    const finishChecking = () => {
      if (!isMounted) return
      setCheckingSession(false)
    }

    const getRoleFromSession = async (): Promise<UserRole> => {
      log('Starting session check')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        log('getUser error:', userError)
        return null
      }

      if (!user) {
        log('No authenticated user found')
        return null
      }

      log('Authenticated user found:', user.id)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        log('Profile lookup error:', profileError)
        return null
      }

      if (!profile?.role) {
        log('Profile found but no role present')
        return null
      }

      log('Resolved role:', profile.role)
      return profile.role as UserRole
    }

    const checkSession = async () => {
      const timeoutId = window.setTimeout(() => {
        timeoutHandledRef.current = true
        log('Session check timed out after 1 second, showing login form')
        finishChecking()
      }, 500)

      try {
        const role = await getRoleFromSession()

        window.clearTimeout(timeoutId)

        if (timeoutHandledRef.current) {
          log('Session result arrived after timeout, ignoring redirect')
          return
        }

        if (!role) {
          log('No valid session role, staying on login page')
          finishChecking()
          return
        }

        if (role === 'admin') {
          log('Redirecting to /admin')
          router.replace('/admin')
          return
        }

        if (role === 'teacher') {
          log('Redirecting to /teacher')
          router.replace('/teacher')
          return
        }

        if (role === 'student') {
          log('Redirecting to /student')
          router.replace('/student')
          return
        }

        log('Unknown role, staying on login page')
        finishChecking()
      } catch (err) {
        window.clearTimeout(timeoutId)
        console.error('[LoginPage] Session check failed:', err)

        if (timeoutHandledRef.current) {
          log('Error happened after timeout, already showing login')
          return
        }

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

    console.log('[LoginPage] Attempting login for:', email)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      console.error('[LoginPage] signInWithPassword error:', signInError)
      setError(signInError.message)
      setLoading(false)
      return
    }

    const user = data.user

    if (!user) {
      console.error('[LoginPage] Login succeeded but no user returned')
      setError('Login failed. Please try again.')
      setLoading(false)
      return
    }

    console.log('[LoginPage] Login success, fetching profile for user:', user.id)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[LoginPage] Profile lookup after login failed:', profileError)
      setError('Profile not found.')
      setLoading(false)
      return
    }

    console.log('[LoginPage] Profile role after login:', profile.role)

    if (profile.role === 'admin') router.replace('/admin')
    else if (profile.role === 'teacher') router.replace('/teacher')
    else router.replace('/student')

    setLoading(false)
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-green-800 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-sm font-medium">Checking session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-green-800 px-4">
      <div className="w-full max-w-md rounded-3xl border border-yellow-300/20 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-white shadow-md">
            <Image
              src="/logo.jpg"
              alt="Qorban Portal Logo"
              width={84}
              height={84}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold tracking-wide text-green-900">
            QORBAN PORTAL
          </h1>
          <p className="mt-1 text-sm font-medium text-yellow-600">
            Online Grade Management System
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-green-800 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}