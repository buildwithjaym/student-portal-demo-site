'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('email', normalizedEmail)
      .single()

    if (profileError || !profile) {
      setError('No account found for that email.')
      setLoading(false)
      return
    }

    if (!profile.is_active) {
      setError('This account is inactive. Please contact the administrator.')
      setLoading(false)
      return
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString()

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: profile.id,
        token,
        expires_at: expiresAt,
      })

    if (tokenError) {
      console.error('[ForgotPasswordPage] Token insert error:', tokenError)
      setError('Failed to process forgot password request.')
      setLoading(false)
      return
    }

    setLoading(false)

    router.replace(`/login/change-password?token=${token}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-950 via-green-900 to-green-800 px-4">
      <div className="w-full max-w-md rounded-3xl border border-yellow-300/20 bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-wide text-green-900">
            Forgot Password
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email to continue resetting your password.
          </p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-5">
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
              disabled={loading}
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
            {loading ? 'Processing...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}