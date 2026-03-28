import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

type RequestBody = {
  email?: string
  code?: string
  newPassword?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESET_CODE_SECRET = process.env.RESET_CODE_SECRET

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidResetCode(value: string) {
  return /^\d{6}$/.test(value)
}

function isStrongEnoughPassword(value: string) {
  return value.length >= 8
}

function hashResetCode(email: string, code: string) {
  if (!RESET_CODE_SECRET) {
    throw new Error('RESET_CODE_SECRET is not configured.')
  }

  return crypto
    .createHmac('sha256', RESET_CODE_SECRET)
    .update(`${email}:${code}`)
    .digest('hex')
}

function safeEqualHex(a: string, b: string) {
  const aBuffer = Buffer.from(a, 'hex')
  const bBuffer = Buffer.from(b, 'hex')

  if (aBuffer.length !== bBuffer.length) return false

  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, message: 'Server configuration is missing.' },
        { status: 500 }
      )
    }

    const body = (await request.json()) as RequestBody

    const email = body.email?.trim().toLowerCase() || ''
    const code = body.code?.trim() || ''
    const newPassword = body.newPassword || ''

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required.' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'OTP code is required.' },
        { status: 400 }
      )
    }

    if (!isValidResetCode(code)) {
      return NextResponse.json(
        { success: false, message: 'OTP code must be a 6-digit number.' },
        { status: 400 }
      )
    }

    if (!newPassword) {
      return NextResponse.json(
        { success: false, message: 'New password is required.' },
        { status: 400 }
      )
    }

    if (!isStrongEnoughPassword(newPassword)) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 8 characters long.' },
        { status: 400 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('[reset-password] profile lookup error:', profileError)

      return NextResponse.json(
        { success: false, message: 'Unable to verify your account right now.' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'No account matched this email.' },
        { status: 404 }
      )
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { success: false, message: 'This account is inactive. Contact the admin.' },
        { status: 403 }
      )
    }

    const { data: resetRequest, error: resetRequestError } = await supabase
      .from('password_reset_requests')
      .select('id, code_hash, expires_at, used_at, created_at')
      .eq('profile_id', profile.id)
      .eq('email', email)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (resetRequestError) {
      console.error(
        '[reset-password] reset request lookup error:',
        resetRequestError
      )

      return NextResponse.json(
        { success: false, message: 'Unable to verify OTP request.' },
        { status: 500 }
      )
    }

    if (!resetRequest) {
      return NextResponse.json(
        { success: false, message: 'No valid OTP request was found.' },
        { status: 404 }
      )
    }

    const isExpired = new Date(resetRequest.expires_at).getTime() < Date.now()

    if (isExpired) {
      return NextResponse.json(
        { success: false, message: 'OTP code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    const submittedHash = hashResetCode(email, code)

    if (!safeEqualHex(submittedHash, resetRequest.code_hash)) {
      return NextResponse.json(
        { success: false, message: 'Invalid OTP code.' },
        { status: 400 }
      )
    }

    const { error: authUpdateError } =
      await supabase.auth.admin.updateUserById(profile.id, {
        password: newPassword,
      })

    if (authUpdateError) {
      console.error('[reset-password] auth update error:', authUpdateError)

      return NextResponse.json(
        { success: false, message: 'Failed to update password.' },
        { status: 500 }
      )
    }

    const usedAt = new Date().toISOString()

    const { error: markUsedError } = await supabase
      .from('password_reset_requests')
      .update({ used_at: usedAt })
      .eq('id', resetRequest.id)

    if (markUsedError) {
      console.error('[reset-password] mark used error:', markUsedError)

      return NextResponse.json(
        {
          success: false,
          message: 'Password changed, but OTP finalization failed.',
        },
        { status: 500 }
      )
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', profile.id)

    if (profileUpdateError) {
      console.error('[reset-password] profile update error:', profileUpdateError)

      return NextResponse.json(
        {
          success: false,
          message: 'Password changed, but profile update failed.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successful.',
    })
  } catch (error) {
    console.error('[reset-password] unexpected error:', error)

    return NextResponse.json(
      { success: false, message: 'Something went wrong while resetting password.' },
      { status: 500 }
    )
  }
}