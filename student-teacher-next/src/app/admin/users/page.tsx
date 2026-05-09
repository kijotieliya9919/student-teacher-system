import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreateUserForm from './create-user-form'

export default async function AdminUsers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()

  const { data: users } = await svc
    .from('users')
    .select('*, classes(name)')
    .order('created_at', { ascending: false })

  const { data: classes } = await svc
    .from('classes')
    .select('*')
    .order('name')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-800">Users</h1>
      </div>

      <div className="mb-8">
        <CreateUserForm classes={classes || []} />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Name</th>
              <th className="text-left p-3 font-medium text-gray-600">Email</th>
              <th className="text-left p-3 font-medium text-gray-600">Role</th>
              <th className="text-left p-3 font-medium text-gray-600">Class</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.full_name}</td>
                <td className="p-3 text-sm text-gray-500">{u.email}</td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-1 rounded text-sm ${
                    u.role === 'admin' ? 'bg-red-100 text-red-700' :
                    u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>{u.role}</span>
                </td>
                <td className="p-3 text-sm text-gray-500">{u.classes?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
