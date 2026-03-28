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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || ''
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@')

  if (!local || !domain) return email

  if (local.length <= 2) {
    return `${local[0] || '*'}*@${domain}`
  }

  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`
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

function buildResetEmailHtml(code: string) {
  const year = new Date().getFullYear()

  return `
    <div style="margin:0;padding:0;background-color:#f3f4f6;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f3f4f6;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);font-family:Arial,sans-serif;">
              <tr>
                <td style="background:linear-gradient(135deg,#052e16,#14532d);padding:28px 32px;text-align:center;">
                  <div style="display:inline-block;background:#ffffff;border-radius:16px;padding:10px 14px;margin-bottom:14px;">
                    <span style="font-size:22px;">🟢</span>
                  </div>
                  <h1 style="margin:0;font-size:28px;line-height:1.2;color:#ffffff;font-weight:700;">
                    Qorban Portal
                  </h1>
                  <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#d1fae5;">
                    Online Grade Management System
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:36px 32px 18px;">
                  <h2 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#111827;font-weight:700;">
                    Password Reset Code
                  </h2>
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
                    We received a request to reset your Qorban Portal password. Use the one-time code below to continue.
                  </p>

                  <div style="margin:24px 0;padding:22px;border:1px solid #d1fae5;border-radius:18px;background:#f0fdf4;text-align:center;">
                    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#166534;font-weight:700;">
                      Your OTP Code
                    </p>
                    <div style="font-size:34px;line-height:1.2;font-weight:800;letter-spacing:10px;color:#14532d;">
                      ${code}
                    </div>
                  </div>

                  <p style="margin:0 0 10px;font-size:14px;line-height:1.8;color:#4b5563;">
                    This code will expire in <strong style="color:#111827;">${OTP_EXPIRY_MINUTES} minutes</strong>.
                  </p>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.8;color:#4b5563;">
                    For your security, do not share this code with anyone.
                  </p>

                  <div style="margin-top:18px;padding:16px 18px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;">
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#9a3412;">
                      If you did not request a password reset, you can safely ignore this email. No changes will be made unless this code is used.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 28px;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
                  <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                    Need help? Contact your system administrator.
                  </p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    © ${year} Qorban Portal. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

function buildResetEmailText(code: string) {
  return `Qorban Portal Password Reset

Your OTP code is: ${code}

This code will expire in ${OTP_EXPIRY_MINUTES} minutes.

If you did not request a password reset, you can ignore this email.`
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
      subject: 'Qorban Portal - Password Reset OTP',
      html: buildResetEmailHtml(code),
      text: buildResetEmailText(code),
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
    const email = normalizeEmail(body.email)

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
      .maybeSingle<ProfileLookup>()

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
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

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
      console.error(
        `[request-password-reset] send email error for ${maskEmail(email)}:`,
        emailError
      )

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