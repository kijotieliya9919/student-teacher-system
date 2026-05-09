import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: admin } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (admin?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { name, code, teacherId, description } = await request.json()

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 })
    }

    const svc = createServiceClient()

    const classData: any = { name, code, description: description || '' }
    if (teacherId) classData.teacher_id = teacherId

    const { data: newClass, error } = await svc
      .from('classes')
      .insert(classData)
      .select()
      .single()

    if (error) {
      if (error.message?.includes('duplicate')) {
        return NextResponse.json({ error: 'Class code already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, class: newClass })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
