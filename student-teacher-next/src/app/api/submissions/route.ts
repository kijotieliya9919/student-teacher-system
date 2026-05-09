import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { student_id, assignment_id, file_path } = await request.json()

    if (!student_id || !assignment_id || !file_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const svc = createServiceClient()

    const { error } = await svc.from('submissions').insert({
      student_id,
      assignment_id,
      file_path,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
