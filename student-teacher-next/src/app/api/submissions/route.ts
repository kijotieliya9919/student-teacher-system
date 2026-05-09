import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const assignmentId = Number(formData.get('assignment_id'))
    const file = formData.get('file') as File | null

    if (!assignmentId || !file) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const svc = createServiceClient()

    const filePath = `submissions/${user.id}_${Date.now()}_${file.name}`

    const { error: uploadError } = await svc.storage
      .from('submissions')
      .upload(filePath, file)

    if (uploadError) {
      return NextResponse.json({ error: 'File upload failed: ' + uploadError.message }, { status: 500 })
    }

    const { data: existing } = await svc.from('assignments').select('id').eq('id', assignmentId).maybeSingle()
    if (!existing) {
      const { data: newAssignment } = await svc.from('assignments_new').select('*').eq('id', assignmentId).single()
      if (newAssignment) {
        await svc.from('assignments').insert({
          id: newAssignment.id,
          course_id: 1,
          title: newAssignment.title,
          description: newAssignment.description,
          file_path: newAssignment.file_path,
          file_name: newAssignment.file_name,
          file_type: newAssignment.file_type,
          instructor_id: newAssignment.teacher_id,
          deadline: newAssignment.deadline,
          created_at: newAssignment.created_at,
        })
      }
    }

    const { error: insertError } = await svc.from('submissions').insert({
      student_id: user.id,
      assignment_id: assignmentId,
      file_path: filePath,
    })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
