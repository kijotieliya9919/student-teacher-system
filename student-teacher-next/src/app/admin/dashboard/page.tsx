import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  const { count: students } = await svc
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  const { count: teachers } = await svc
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'teacher')

  const { count: classCount } = await svc
    .from('classes')
    .select('*', { count: 'exact', head: true })

  const { count: assignmentCount } = await svc
    .from('assignments_new')
    .select('*', { count: 'exact', head: true })

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Students</h3>
          <p className="text-3xl font-bold">{students || 0}</p>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Teachers</h3>
          <p className="text-3xl font-bold">{teachers || 0}</p>
        </div>
        <div className="bg-purple-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Classes</h3>
          <p className="text-3xl font-bold">{classCount || 0}</p>
        </div>
        <div className="bg-yellow-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Assignments</h3>
          <p className="text-3xl font-bold">{assignmentCount || 0}</p>
        </div>
      </div>
    </div>
  )
}
