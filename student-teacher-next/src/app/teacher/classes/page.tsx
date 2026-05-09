import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TeacherClasses() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user.id)
    .order('name')

  const { data: allClasses } = await supabase
    .from('classes')
    .select('*, users!inner(full_name)')
    .eq('users.role', 'student')
    .order('name')

  const classStudentCounts: Record<number, number> = {}
  for (const c of allClasses || []) {
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

      {!classes || classes.length === 0 ? (
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
