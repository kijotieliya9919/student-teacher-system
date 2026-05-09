import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignmentId, studentId, grade, feedback } = await request.json()

    if (!assignmentId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { error } = await svc.from('audit_logs').insert({
      user_id: studentId,
      action: `grade_${assignmentId}_${studentId}`,
      details: JSON.stringify({ grade, feedback }),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
