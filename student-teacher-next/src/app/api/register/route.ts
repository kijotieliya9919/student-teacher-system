import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, classId } = await request.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['student', 'teacher'].includes(role)) {
      return NextResponse.json({ error: 'Role must be student or teacher' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { data: authData, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: fullName },
    })

    if (authError) {
      if (authError.message?.includes('already exists')) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const uid = authData.user?.id
    if (!uid) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })

    const profile: any = { id: uid, email, full_name: fullName, role }
    if (role === 'student' && classId) profile.class_id = Number(classId)

    const { error: insertError } = await svc.from('users').insert(profile)
    if (insertError) {
      await svc.auth.admin.deleteUser(uid)
      return NextResponse.json({ error: 'Failed to create profile: ' + insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: uid })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
