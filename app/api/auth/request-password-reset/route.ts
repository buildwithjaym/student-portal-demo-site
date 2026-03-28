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
const LOGO_URL = 'https://www.qorbanportal.online/logo.jpg'

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
      debug,
    },
    { status }
  )
}

function buildResetEmailHtml(code: string) {
  const year = new Date().getFullYear()

  return `
    <div style="margin:0;padding:0;background:#f3f7f4;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#f3f7f4;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" style="width:100%;max-width:620px;border-collapse:collapse;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 34px rgba(0,0,0,0.10);font-family:Arial,sans-serif;">
              
              <tr>
                <td style="background:linear-gradient(135deg,#052e16 0%,#166534 55%,#15803d 100%);padding:32px 28px;text-align:center;">
                  <div style="margin-bottom:16px;">
                    <img
                      src="${LOGO_URL}"
                      alt="Qorban Portal Logo"
                      width="84"
                      height="84"
                      style="display:block;margin:0 auto;border-radius:50%;background:#ffffff;padding:6px;border:4px solid #facc15;object-fit:contain;"
                    />
                  </div>

                  <h1 style="margin:0;font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:0.02em;">
                    Qorban Portal
                  </h1>
                  <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#dcfce7;">
                    Online Grade Management System
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:36px 30px 18px;">
                  <h2 style="margin:0 0 12px;font-size:26px;line-height:1.3;color:#111827;font-weight:800;">
                    Password Reset OTP
                  </h2>

                  <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4b5563;">
                    We received a request to reset your Qorban Portal password. Use the one-time password below to continue securely.
                  </p>

                  <div style="margin:26px 0;padding:24px;border:1px solid #bbf7d0;border-radius:20px;background:linear-gradient(180deg,#f0fdf4 0%,#ecfdf5 100%);text-align:center;">
                    <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#166534;font-weight:800;">
                      Your One-Time Password
                    </p>
                    <div style="font-size:36px;line-height:1.2;font-weight:800;letter-spacing:10px;color:#14532d;">
                      ${code}
                    </div>
                  </div>

                  <div style="margin:0 0 18px;padding:16px 18px;border-radius:16px;background:#f9fafb;border:1px solid #e5e7eb;">
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.8;color:#374151;">
                      This OTP will expire in <strong style="color:#111827;">${OTP_EXPIRY_MINUTES} minutes</strong>.
                    </p>
                    <p style="margin:0;font-size:14px;line-height:1.8;color:#374151;">
                      For your security, do not share this code with anyone.
                    </p>
                  </div>

                  <div style="margin-top:16px;padding:16px 18px;border-radius:16px;background:#fffbeb;border:1px solid #fde68a;">
                    <p style="margin:0;font-size:13px;line-height:1.8;color:#92400e;">
                      If you did not request this password reset, you can safely ignore this email. No changes will be made unless this OTP is used.
                    </p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 30px 30px;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
                  <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">
                    Need help? Please contact your system administrator.
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
  return `Qorban Portal - Password Reset OTP

Your OTP code is: ${code}

This OTP will expire in ${OTP_EXPIRY_MINUTES} minutes.

If you did not request a password reset, you can ignore this email.`
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
      html: buildResetEmailHtml(code),
      text: buildResetEmailText(code),
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
      console.error(
        `[request-password-reset] email send error for ${maskEmail(email)}:`,
        emailError
      )

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
      debug: { step: 'done' },
    })
  } catch (error) {
    console.error('[request-password-reset] unexpected error:', error)

    return errorResponse('Something went wrong while sending OTP.', 500, {
      step: 'unexpected',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}