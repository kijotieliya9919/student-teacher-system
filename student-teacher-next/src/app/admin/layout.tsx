import Link from 'next/link'
import { getUserFromHeaders } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await getUserFromHeaders()
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .single()

  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-green-800 text-white p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">FORESTRY INST.</h2>
          <p className="text-green-300 text-sm">Admin Portal</p>
        </div>
        <p className="text-green-200 text-sm mb-4">Welcome, {profile?.full_name || 'Admin'}</p>
        <div className="flex-1 space-y-2">
          <Link href="/admin/dashboard" className="block px-3 py-2 rounded hover:bg-green-700 transition">Dashboard</Link>
          <Link href="/admin/users" className="block px-3 py-2 rounded hover:bg-green-700 transition">Users</Link>
          <Link href="/admin/classes" className="block px-3 py-2 rounded hover:bg-green-700 transition">Classes</Link>
        </div>
        <Link href="/auth/signout" className="block px-3 py-2 rounded hover:bg-green-700 transition mt-auto">Logout</Link>
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
