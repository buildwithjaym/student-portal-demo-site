import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CreateStudentPayload = {
  student_no: string
  email: string
  first_name: string
  middle_name?: string | null
  last_name: string
  suffix?: string | null
  grade_level: 'Grade 11' | 'Grade 12'
  section: string
  is_active: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateStudentPayload

    // Trim and normalize input fields
    const student_no = body.student_no?.trim()
    const email = body.email?.trim().toLowerCase()
    const first_name = body.first_name?.trim()
    const middle_name = body.middle_name?.trim() || null
    const last_name = body.last_name?.trim()
    const suffix = body.suffix?.trim() || null
    const grade_level = body.grade_level
    const section = body.section?.trim()
    const is_active = body.is_active ?? true

    // Validate required fields
    if (!student_no || !email || !first_name || !last_name || !grade_level || !section) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // Validate grade level
    if (!['Grade 11', 'Grade 12'].includes(grade_level)) {
      return NextResponse.json({ error: 'Invalid grade level.' }, { status: 400 })
    }

    const temporaryPassword = student_no

    // Create user in Supabase Auth with email confirmed
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Confirm email during creation
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

    // Insert profile data
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
      // Rollback: delete user if profile insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Insert student data
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
        grade_level,
        section,
        is_active,
      })

    if (studentError) {
      // Rollback: delete profile and auth user if student insert fails
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: studentError.message }, { status: 400 })
    }

    // Success response
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