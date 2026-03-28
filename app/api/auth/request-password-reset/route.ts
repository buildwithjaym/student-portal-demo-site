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

// --------------------
// Helpers
// --------------------

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString()
}

function hashCode(email: string, code: string) {
  if (!RESET_CODE_SECRET) {
    throw new Error('RESET_CODE_SECRET missing')
  }

  return crypto
    .createHmac('sha256', RESET_CODE_SECRET)
    .update(`${email}:${code}`)
    .digest('hex')
}

// --------------------
// Route
// --------------------

export async function POST(req: Request) {
  try {
    // ✅ ENV CHECK
    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !RESEND_API_KEY ||
      !RESET_EMAIL_FROM ||
      !RESET_CODE_SECRET
    ) {
      console.error('❌ Missing ENV')

      return NextResponse.json(
        { success: false, message: 'Server not configured properly.' },
        { status: 500 }
      )
    }

    const body = (await req.json()) as RequestBody
    const email = body.email?.trim().toLowerCase() || ''

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email.' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    )

    // --------------------
    // Check profile
    // --------------------

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('email', email)
      .maybeSingle()

    if (profileError) {
      console.error('PROFILE ERROR:', profileError)
      throw profileError
    }

    if (!profile) {
      return NextResponse.json(
        { success: false, message: 'No account found.' },
        { status: 404 }
      )
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { success: false, message: 'Account inactive.' },
        { status: 403 }
      )
    }

    // --------------------
    // Generate OTP
    // --------------------

    const code = generateCode()
    const codeHash = hashCode(email, code)

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // invalidate old
    await supabase
      .from('password_reset_requests')
      .update({ used_at: new Date().toISOString() })
      .eq('profile_id', profile.id)
      .is('used_at', null)

    // insert new
    const { error: insertError } = await supabase
      .from('password_reset_requests')
      .insert({
        profile_id: profile.id,
        email,
        code_hash: codeHash,
        expires_at: expiresAt,
      })

    if (insertError) {
      console.error('INSERT ERROR:', insertError)
      throw insertError
    }

    // --------------------
    // SEND EMAIL (RESEND)
    // --------------------

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESET_EMAIL_FROM,
        to: [email],
        subject: 'Qorban Portal OTP Code',
        html: `<h2>Your OTP Code</h2><p style="font-size:24px">${code}</p>`,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error('EMAIL ERROR:', errText)
      throw new Error('Email failed')
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email.',
    })
  } catch (err) {
    console.error('❌ RESET REQUEST ERROR:', err)

    return NextResponse.json(
      { success: false, message: 'Failed to send OTP.' },
      { status: 500 }
    )
  }
}