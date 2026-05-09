import { requireAuth } from '@/lib/auth'

export default async function AdminDashboard() {
  await requireAuth('admin')

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/users" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">Manage Users</h3>
          <p className="text-sm text-gray-500 mt-2">Create and manage student & teacher accounts</p>
        </a>
        <a href="/admin/classes" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">Manage Classes</h3>
          <p className="text-sm text-gray-500 mt-2">Create and manage classes</p>
        </a>
      </div>
    </div>
  )
}
