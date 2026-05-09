import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form'

export default async function NewAssignment() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('class_id')
    .eq('id', user.id)
    .single()

  let classes: any[] = []
  if (profile?.class_id) {
    const { data: c } = await supabase
      .from('classes')
      .select('*')
      .eq('id', profile.class_id)
    classes = c || []
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Upload Assignment</h1>
      <UploadForm classes={classes || []} teacherId={user.id} />
    </div>
  )
}
