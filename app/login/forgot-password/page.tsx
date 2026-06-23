'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ProfileLookup = {
  id: string
  email: string
  is_active: boolean
}

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const isValidEmailFormat = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const resetFeedback = () => {
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) return

    setLoading(true)
    resetFeedback()

    try {
      if (!normalizedEmail) {
        setError('Please enter your email address.')
        return
      }

      if (!isValidEmailFormat(normalizedEmail)) {
        setError('Please enter a valid email address.')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, is_active')
        .eq('email', normalizedEmail)
        .maybeSingle<ProfileLookup>()

      if (profileError) {
        setError('Unable to verify your account right now. Please try again.')
        return
      }

      if (!profile) {
        setError('No account matched this email.')
        return
      }

      if (!profile.is_active) {
        setError('This account is inactive. Contact the admin.')
        return
      }

      const response = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      let result: { success?: boolean; message?: string } = {}

      try {
        result = await response.json()
      } catch {
        setError('Server returned an invalid response.')
        return
      }

      if (!response.ok || !result.success) {
        setError(result.message || 'Failed to send OTP.')
        return
      }

      setMessage('OTP has been sent to your Gmail. Redirecting to reset password...')

      window.setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`)
      }, 1200)
    } catch (err) {
      console.error('[ForgotPasswordPage] unexpected error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }


return (
  <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-blue-900 px-4 py-8">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
      <div className="grid w-full overflow-hidden rounded-[28px] bg-white shadow-2xl lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left Panel */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 p-8 text-white xl:p-10">
          <div>
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-white shadow">
                <Image
                  src="/logo.jpg"
                  alt="Student Portal Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-wide">
                  STUDENT PORTAL
                </h1>

                <p className="text-sm text-cyan-300">
                  Academic Management System
                </p>
              </div>
            </div>

            <h2 className="max-w-sm text-3xl font-semibold leading-tight">
              Forgot your password?
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-blue-100/90">
              Enter your registered email address. If your account is active,
              a one-time verification code will be sent to your email so you
              can securely reset your password.
            </p>
          </div>

          <div className="space-y-3 text-sm text-blue-100/90">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Registered email required
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Verification code sent to email
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Active accounts only
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-cyan-500 bg-white shadow-md lg:hidden">
                <Image
                  src="/logo.jpg"
                  alt="Student Portal Logo"
                  width={68}
                  height={68}
                  className="object-contain"
                  priority
                />
              </div>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Forgot Password
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                We will send a verification code to your registered email.
              </p>
            </div>

            {message && (
              <div
                className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800"
                role="status"
              >
                {message}
              </div>
            )}

            {error && (
              <div
                className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Registered Email
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error || message) resetFeedback()
                  }}
                  placeholder="name@example.com"
                  required
                  disabled={loading}
                  className="
                    w-full rounded-2xl border border-gray-300
                    px-4 py-3.5 text-gray-900 outline-none transition
                    focus:border-cyan-600
                    focus:ring-2
                    focus:ring-cyan-200
                    disabled:cursor-not-allowed
                    disabled:bg-gray-100
                  "
                />

                <p className="mt-2 text-xs text-gray-500">
                  This must match the email registered in your account.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="
                  w-full rounded-2xl
                  bg-gradient-to-r
                  from-blue-900
                  to-cyan-600
                  py-3.5
                  font-semibold
                  text-white
                  shadow-lg
                  transition
                  hover:opacity-95
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-800 transition hover:text-blue-950 hover:underline"
              >
                Back to Login
              </Link>

              <span className="text-xs text-gray-500">
                Student Portal
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

}