import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CreateTeacherPayload = {
  teacher_no: string
  email: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  contact?: string | null
  address?: string | null
  is_active: boolean
}

export async function POST(req: Request) {
  const startedAt = Date.now()

  try {
    const body = (await req.json()) as CreateTeacherPayload

    const teacher_no = body.teacher_no?.trim()
    const email = body.email?.trim().toLowerCase()
    const first_name = body.first_name?.trim()
    const middle_name = body.middle_name?.trim() || null
    const last_name = body.last_name?.trim()
    const suffix = body.suffix?.trim() || null
    const contact = body.contact?.trim() || null
    const address = body.address?.trim() || null
    const is_active = body.is_active ?? true

    if (!teacher_no || !email || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      )
    }
    if (address && address.length > 255) {
  return NextResponse.json(
        { error: 'Address is too long.' },
        { status: 400 }
      )
    }
    const temporaryPassword = teacher_no

    const authStarted = Date.now()
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: 'teacher',
          first_name,
          middle_name,
          last_name,
          suffix,
          teacher_no,
          contact,
          address,
        },
      })
    console.log('createUser ms:', Date.now() - authStarted)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth user.' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    const profileStarted = Date.now()
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email,
      first_name,
      middle_name,
      last_name,
      suffix,
      role: 'teacher',
      is_active,
      must_change_password: true,
    })
    console.log('insert profile ms:', Date.now() - profileStarted)

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    const teacherStarted = Date.now()
    const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
      profile_id: userId,
      teacher_no,
      email,
      first_name,
      middle_name,
      last_name,
      suffix,
      contact,
      address,
      is_active,
    })
    console.log('insert teacher ms:', Date.now() - teacherStarted)

    if (teacherError) {
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)

      return NextResponse.json(
        { error: teacherError.message },
        { status: 400 }
      )
    }

    console.log('total route ms:', Date.now() - startedAt)

    return NextResponse.json({
      success: true,
      message: 'Teacher account created successfully.',
      temporary_password: temporaryPassword,
    })
  } catch (error: any) {
    console.log('total route ms before error:', Date.now() - startedAt)

    return NextResponse.json(
      { error: error.message || 'Unexpected server error.' },
      { status: 500 }
    )
  }
}