import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form'

export default async function NewAssignment() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user.id)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Upload Assignment</h1>
      <UploadForm classes={classes || []} teacherId={user.id} />
    </div>
  )
}
