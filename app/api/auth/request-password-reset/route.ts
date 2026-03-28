import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

type RequestBody = {
  email?: string
}

type ProfileLookup = {
  id: string
  email: string
  is_active: boolean
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESET_CODE_SECRET = process.env.RESET_CODE_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESET_EMAIL_FROM = process.env.RESET_EMAIL_FROM

const OTP_EXPIRY_MINUTES = 10
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000
const OTP_LENGTH = 6
const IS_PROD = process.env.NODE_ENV === 'production'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || ''
}

function generateResetCode() {
  const min = 10 ** (OTP_LENGTH - 1)
  const max = 10 ** OTP_LENGTH
  return crypto.randomInt(min, max).toString()
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

function getMissingEnvKeys() {
  const missing: string[] = []

  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!RESET_CODE_SECRET) missing.push('RESET_CODE_SECRET')
  if (!RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (!RESET_EMAIL_FROM) missing.push('RESET_EMAIL_FROM')

  return missing
}

function errorResponse(
  message: string,
  status: number,
  debug?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(IS_PROD ? {} : { debug }),
    },
    { status }
  )
}

async function sendResetOtpEmail(to: string, code: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESET_EMAIL_FROM,
      to: [to],
      subject: 'Qorban Portal - Password Reset OTP',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <h2>Qorban Portal</h2>
          <p>Your OTP code is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#166534;margin:16px 0;">
            ${code}
          </div>
          <p>This code will expire in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
      text: `Qorban Portal Password Reset\n\nYour OTP code is: ${code}\n\nThis code will expire in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request a password reset, you can ignore this email.`,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Resend error: ${errorText}`)
  }
}

export async function POST(request: Request) {
  try {
    const missingEnv = getMissingEnvKeys()

    if (missingEnv.length > 0) {
      console.error('[request-password-reset] missing env:', missingEnv)

      return errorResponse('Server not configured properly.', 500, {
        step: 'env_check',
        missingEnv,
      })
    }

    const body = (await request.json()) as RequestBody
    const email = normalizeEmail(body.email)

    if (!email) {
      return errorResponse('Email is required.', 400, {
        step: 'validate_email',
      })
    }

    if (!isValidEmail(email)) {
      return errorResponse('Please enter a valid email address.', 400, {
        step: 'validate_email',
        email,
      })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, is_active')
      .eq('email', email)
      .maybeSingle<ProfileLookup>()

    if (profileError) {
      console.error('[request-password-reset] profile lookup error:', profileError)

      return errorResponse('Unable to verify your account right now.', 500, {
        step: 'profile_lookup',
        profileError,
      })
    }

    if (!profile) {
      return errorResponse('No account matched this email.', 404, {
        step: 'profile_lookup',
        email,
      })
    }

    if (!profile.is_active) {
      return errorResponse('This account is inactive. Contact the admin.', 403, {
        step: 'profile_lookup',
        email,
      })
    }

    const resetCode = generateResetCode()
    const codeHash = hashResetCode(email, resetCode)
    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

    const { error: invalidateError } = await supabase
      .from('password_reset_requests')
      .update({ used_at: nowIso })
      .eq('profile_id', profile.id)
      .is('used_at', null)

    if (invalidateError) {
      console.error('[request-password-reset] invalidate error:', invalidateError)

      return errorResponse('Failed to prepare password reset request.', 500, {
        step: 'invalidate_old_requests',
        invalidateError,
      })
    }

    const { data: insertedRequest, error: insertError } = await supabase
      .from('password_reset_requests')
      .insert({
        profile_id: profile.id,
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[request-password-reset] insert error:', insertError)

      return errorResponse('Failed to create password reset request.', 500, {
        step: 'insert_reset_request',
        insertError,
      })
    }

    try {
      await sendResetOtpEmail(email, resetCode)
    } catch (emailError) {
      console.error('[request-password-reset] email send error:', emailError)

      await supabase
        .from('password_reset_requests')
        .update({ used_at: new Date().toISOString() })
        .eq('id', insertedRequest.id)

      return errorResponse('Failed to send OTP to your email.', 500, {
        step: 'send_email',
        emailError:
          emailError instanceof Error ? emailError.message : String(emailError),
      })
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

      return errorResponse(
        'OTP sent, but account update failed. Please contact support.',
        500,
        {
          step: 'update_profile',
          profileUpdateError,
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP has been sent to your Gmail.',
      ...(IS_PROD ? {} : { debug: { step: 'done' } }),
    })
  } catch (error) {
    console.error('[request-password-reset] unexpected error:', error)

    return errorResponse('Something went wrong while sending OTP.', 500, {
      step: 'unexpected',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}