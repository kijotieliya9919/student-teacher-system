import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-green-800 text-white p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">FORESTRY INST.</h2>
          <p className="text-green-300 text-sm">Teacher Portal</p>
        </div>
        <p className="text-green-200 text-sm mb-4">Welcome, {profile?.full_name || 'Teacher'}</p>
        <div className="flex-1 space-y-2">
          <Link href="/teacher/dashboard" className="block px-3 py-2 rounded hover:bg-green-700 transition">Dashboard</Link>
          <Link href="/teacher/assignments/new" className="block px-3 py-2 rounded hover:bg-green-700 transition">Upload Assignment</Link>
          <Link href="/teacher/classes" className="block px-3 py-2 rounded hover:bg-green-700 transition">My Classes</Link>
        </div>
        <Link href="/auth/signout" className="block px-3 py-2 rounded hover:bg-green-700 transition mt-auto">Logout</Link>
      </nav>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
