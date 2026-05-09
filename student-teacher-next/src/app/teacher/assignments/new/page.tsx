import { requireAuth } from '@/lib/auth'
import UploadForm from './upload-form'

export default async function NewAssignment() {
  const { svc, userId } = await requireAuth('teacher')

  const { data: profile } = await svc
    .from('users')
    .select('class_id')
    .eq('id', userId)
    .single()

  let classes: any[] = []
  if (profile?.class_id) {
    const { data: c } = await svc
      .from('classes')
      .select('*')
      .eq('id', profile.class_id)
    classes = c || []
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Upload Assignment</h1>
      <UploadForm classes={classes || []} teacherId={userId} />
    </div>
  )
}
