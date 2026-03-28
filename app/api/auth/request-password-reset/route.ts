import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

type RequestBody = {
  email?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESET_CODE_SECRET = process.env.RESET_CODE_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESET_EMAIL_FROM = process.env.RESET_EMAIL_FROM

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function generateResetCode() {
  return crypto.randomInt(100000, 1000000).toString()
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

async function sendResetOtpEmail(to: string, code: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured.')
  }

  if (!RESET_EMAIL_FROM) {
    throw new Error('RESET_EMAIL_FROM is not configured.')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESET_EMAIL_FROM,
      to: [to],
      subject: 'Qorban Portal Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 8px;">Qorban Portal</h2>
          <p>Your password reset code is:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #166534;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send reset email: ${errorText}`)
  }
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('[request-password-reset] profile lookup error:', profileError)

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

    const resetCode = generateResetCode()
    const codeHash = hashResetCode(email, resetCode)
    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: invalidateError } = await supabase
      .from('password_reset_requests')
      .update({ used_at: nowIso })
      .eq('profile_id', profile.id)
      .is('used_at', null)

    if (invalidateError) {
      console.error(
        '[request-password-reset] invalidate previous requests error:',
        invalidateError
      )

      return NextResponse.json(
        { success: false, message: 'Failed to prepare password reset request.' },
        { status: 500 }
      )
    }

    const { error: insertError } = await supabase
      .from('password_reset_requests')
      .insert({
        profile_id: profile.id,
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('[request-password-reset] insert request error:', insertError)

      return NextResponse.json(
        { success: false, message: 'Failed to create password reset request.' },
        { status: 500 }
      )
    }

    try {
      await sendResetOtpEmail(email, resetCode)
    } catch (emailError) {
      console.error('[request-password-reset] send email error:', emailError)

      await supabase
        .from('password_reset_requests')
        .update({ used_at: new Date().toISOString() })
        .eq('profile_id', profile.id)
        .eq('email', email)
        .eq('code_hash', codeHash)
        .is('used_at', null)

      return NextResponse.json(
        { success: false, message: 'Failed to send OTP to your email.' },
        { status: 500 }
      )
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', profile.id)

    if (profileUpdateError) {
      console.error(
        '[request-password-reset] profile update error:',
        profileUpdateError
      )

      return NextResponse.json(
        {
          success: false,
          message: 'OTP sent, but account update failed. Please contact support.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP has been sent to your Gmail.',
    })
  } catch (error) {
    console.error('[request-password-reset] unexpected error:', error)

    return NextResponse.json(
      { success: false, message: 'Something went wrong while sending OTP.' },
      { status: 500 }
    )
  }
}