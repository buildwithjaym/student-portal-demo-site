'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ProfileRow = {
  id: string
  role: 'admin' | 'teacher' | 'student'
  must_change_password: boolean
  is_active: boolean
}

function getRedirectPath(role: ProfileRow['role']) {
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/student'
}

export default function ChangePasswordPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      matches: password.length > 0 && password === confirmPassword,
    }
  }, [password, confirmPassword])

  const isPasswordStrong =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasLowercase &&
    passwordChecks.hasNumber

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        toast.error('Please log in first.')
        router.replace('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, must_change_password, is_active')
        .eq('id', user.id)
        .maybeSingle()

      if (error || !data) {
        toast.error('Failed to load profile.')
        router.replace('/login')
        return
      }

      const profileRow = data as ProfileRow

      if (!profileRow.is_active) {
        toast.error('Your account is inactive.')
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      setProfile(profileRow)

      if (!profileRow.must_change_password) {
        router.replace(getRedirectPath(profileRow.role))
        return
      }

      setLoading(false)
    }

    loadUser()
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!isPasswordStrong) {
      toast.error(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      )
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setSaving(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      toast.error('Session expired. Please log in again.')
      setSaving(false)
      router.replace('/login')
      return
    }

    const { error: updatePasswordError } = await supabase.auth.updateUser({
      password,
    })

    if (updatePasswordError) {
      toast.error(updatePasswordError.message)
      setSaving(false)
      return
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id)

    if (profileUpdateError) {
      toast.error(profileUpdateError.message)
      setSaving(false)
      return
    }

    toast.success('Password changed successfully.')

    if (profile) {
      router.replace(getRedirectPath(profile.role))
    } else {
      router.replace('/login')
    }

    setSaving(false)
  }

  
if (loading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="text-sm text-gray-500">Loading account...</p>
      </div>
    </div>
  )
}



return (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-blue-900 px-4 py-10">
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
    >
      <div className="mb-6">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
          <ShieldCheck className="h-7 w-7" />
        </div>

        <p className="text-sm font-medium text-cyan-700">
          Student Portal Security
        </p>

        <h1 className="text-3xl font-bold text-slate-900">
          Change Password
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          For security purposes, you must create a new password before accessing
          your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            New Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              disabled={saving}
              required
              className="
                w-full rounded-xl border border-gray-300
                px-4 py-3 pr-12 outline-none transition
                focus:border-cyan-600
                focus:ring-2
                focus:ring-cyan-200
              "
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={saving}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                text-gray-500 transition hover:text-gray-700
              "
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Confirm New Password
          </label>

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={saving}
              required
              className="
                w-full rounded-xl border border-gray-300
                px-4 py-3 pr-12 outline-none transition
                focus:border-cyan-600
                focus:ring-2
                focus:ring-cyan-200
              "
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              disabled={saving}
              aria-label={
                showConfirmPassword
                  ? 'Hide confirm password'
                  : 'Show confirm password'
              }
              className="
                absolute right-3 top-1/2 -translate-y-1/2
                text-gray-500 transition hover:text-gray-700
              "
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-semibold text-gray-700">
            Password Requirements
          </p>

          <div className="space-y-1">
            <p
              className={
                passwordChecks.minLength
                  ? 'text-cyan-700'
                  : 'text-gray-500'
              }
            >
              • At least 8 characters
            </p>

            <p
              className={
                passwordChecks.hasUppercase
                  ? 'text-cyan-700'
                  : 'text-gray-500'
              }
            >
              • At least 1 uppercase letter
            </p>

            <p
              className={
                passwordChecks.hasLowercase
                  ? 'text-cyan-700'
                  : 'text-gray-500'
              }
            >
              • At least 1 lowercase letter
            </p>

            <p
              className={
                passwordChecks.hasNumber
                  ? 'text-cyan-700'
                  : 'text-gray-500'
              }
            >
              • At least 1 number
            </p>

            <p
              className={
                confirmPassword.length === 0
                  ? 'text-gray-500'
                  : passwordChecks.matches
                    ? 'text-cyan-700'
                    : 'text-red-600'
              }
            >
              • Passwords must match
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="
            w-full rounded-xl
            bg-gradient-to-r
            from-blue-900
            to-cyan-600
            px-5 py-3
            font-semibold
            text-white
            shadow-lg
            transition
            hover:opacity-95
            disabled:opacity-60
          "
        >
          {saving ? 'Updating Password...' : 'Save New Password'}
        </button>
      </form>
    </motion.div>
  </div>
)

}