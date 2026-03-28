import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CreateStudentPayload = {
  student_no: string
  email: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  gender: 'Male' | 'Female'
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  is_active: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateStudentPayload

    const student_no = body.student_no?.trim()
    const email = body.email?.trim().toLowerCase()
    const first_name = body.first_name?.trim()
    const middle_name = body.middle_name?.trim() || null
    const last_name = body.last_name?.trim()
    const suffix = body.suffix?.trim() || null
    const gender = body.gender?.trim() as 'Male' | 'Female'
    const grade_level = body.grade_level
    const section = body.section?.trim()
    const is_active = body.is_active ?? true

    if (
      !student_no ||
      !email ||
      !first_name ||
      !last_name ||
      !gender ||
      !grade_level ||
      !section
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (!['Male', 'Female'].includes(gender)) {
      return NextResponse.json({ error: 'Invalid gender.' }, { status: 400 })
    }

    if (!['Grade 11', 'Grade 12'].includes(grade_level)) {
      return NextResponse.json({ error: 'Invalid grade level.' }, { status: 400 })
    }

    const temporaryPassword = student_no

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          first_name,
          middle_name,
          last_name,
          suffix,
          student_no,
        },
      })

    if (authError || !authData?.user?.id) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth user.' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        first_name,
        middle_name,
        last_name,
        suffix,
        role: 'student',
        is_active,
        must_change_password: true,
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    const { error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        profile_id: userId,
        student_no,
        email,
        first_name,
        middle_name,
        last_name,
        suffix,
        gender,
        grade_level,
        section,
        is_active,
      })

    if (studentError) {
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: studentError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Student account created successfully.',
      temporary_password: temporaryPassword,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unexpected server error.' },
      { status: 500 }
    )
  }
}