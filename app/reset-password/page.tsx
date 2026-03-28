'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialEmail = searchParams.get('email') ?? ''

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const normalizedCode = useMemo(() => code.trim(), [code])

  const isValidEmailFormat = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  const isValidResetCode = (value: string) => {
    return /^\d{6}$/.test(value)
  }

  const isStrongEnoughPassword = (value: string) => {
    return value.length >= 8
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

      if (!normalizedCode) {
        setError('Please enter your OTP code.')
        return
      }

      if (!isValidResetCode(normalizedCode)) {
        setError('OTP code must be a 6-digit number.')
        return
      }

      if (!newPassword) {
        setError('Please enter your new password.')
        return
      }

      if (!isStrongEnoughPassword(newPassword)) {
        setError('Password must be at least 8 characters long.')
        return
      }

      if (!confirmPassword) {
        setError('Please confirm your new password.')
        return
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          code: normalizedCode,
          newPassword,
        }),
      })

      let result: { success?: boolean; message?: string } = {}

      try {
        result = await response.json()
      } catch {
        setError('Server returned an invalid response.')
        return
      }

      if (!response.ok || !result.success) {
        setError(result.message || 'Failed to reset password.')
        return
      }

      setMessage('Password reset successful. Redirecting to login...')

      window.setTimeout(() => {
        router.push('/login')
      }, 1200)
    } catch (err) {
      console.error('[ResetPasswordPage] unexpected error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-950 via-green-900 to-emerald-800 px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] bg-white shadow-2xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-green-950 via-green-900 to-green-800 p-8 text-white xl:p-10">
            <div>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-yellow-300/30 bg-white shadow">
                  <Image
                    src="/logo.jpg"
                    alt="Qorban Portal Logo"
                    width={48}
                    height={48}
                    className="object-contain"
                    priority
                  />
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-wide">QORBAN PORTAL</h1>
                  <p className="text-sm text-yellow-300">Online Grade Management System</p>
                </div>
              </div>

              <h2 className="max-w-sm text-3xl font-semibold leading-tight">
                Reset your password
              </h2>

              <p className="mt-4 max-w-md text-sm leading-7 text-green-100/90">
                Enter the OTP code sent to your Gmail and create your new password
                to complete account recovery.
              </p>
            </div>

            <div className="space-y-3 text-sm text-green-100/90">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                OTP code sent by email
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Password must match confirmation
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Reset request expires after a few minutes
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center lg:text-left">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-white shadow-md lg:hidden">
                  <Image
                    src="/logo.jpg"
                    alt="Qorban Portal Logo"
                    width={68}
                    height={68}
                    className="object-contain"
                    priority
                  />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-green-950">
                  Reset Password
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Enter the OTP code from your Gmail and set a new password.
                </p>
              </div>

              {message && (
                <div
                  className="mb-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
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
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="code"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    OTP Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => {
                      const onlyDigits = e.target.value.replace(/\D/g, '')
                      setCode(onlyDigits)
                      if (error || message) resetFeedback()
                    }}
                    placeholder="Enter 6-digit OTP"
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 tracking-[0.2em] outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Check your Gmail inbox for the OTP code.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value)
                      if (error || message) resetFeedback()
                    }}
                    placeholder="Enter new password"
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Password must be at least 8 characters long.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      if (error || message) resetFeedback()
                    }}
                    placeholder="Confirm new password"
                    required
                    disabled={loading}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3.5 text-gray-900 outline-none transition focus:border-green-700 focus:ring-2 focus:ring-green-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-green-800 py-3.5 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Resetting password...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-4">
                <Link
                  href="/login/forgot-password"
                  className="text-sm font-medium text-green-800 transition hover:text-green-900 hover:underline"
                >
                  Back to Forgot Password
                </Link>

                <span className="text-xs text-gray-500">Qorban Portal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}