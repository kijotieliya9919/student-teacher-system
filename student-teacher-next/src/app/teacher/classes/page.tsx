import { requireAuth } from '@/lib/auth'

export default async function TeacherClasses() {
  const { supabase, user } = await requireAuth('teacher')

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

  const classStudentCounts: Record<number, number> = {}
  for (const c of classes) {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', c.id)
      .eq('role', 'student')
    classStudentCounts[c.id] = count || 0
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">My Classes</h1>

      {classes.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
          You have no classes assigned. Contact an administrator.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => (
            <div key={c.id} className="bg-white p-6 rounded-lg shadow">
              <h3 className="font-semibold text-lg">{c.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{c.code}</p>
              {c.description && <p className="text-sm text-gray-600 mt-2">{c.description}</p>}
              <p className="text-sm mt-2">
                <span className="font-medium">{classStudentCounts[c.id] || 0}</span> students
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
