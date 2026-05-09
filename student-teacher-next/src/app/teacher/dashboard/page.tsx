import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignments } = await supabase
    .from('assignments_new')
    .select('*, classes(name)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, assignments_new!inner(teacher_id)')
    .eq('assignments_new.teacher_id', user.id)

  const pendingSubmissions = (submissions || []).filter(s => !s.grade)

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Teacher Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Total Assignments</h3>
          <p className="text-3xl font-bold">{(assignments || []).length}</p>
        </div>
        <div className="bg-yellow-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Pending Grading</h3>
          <p className="text-3xl font-bold">{pendingSubmissions.length}</p>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Total Submissions</h3>
          <p className="text-3xl font-bold">{(submissions || []).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Recent Assignments</h2>
          <Link href="/teacher/assignments/new" className="text-green-600 text-sm hover:underline">Upload New</Link>
        </div>
        <div className="p-4">
          {!assignments || assignments.length === 0 ? (
            <p className="text-gray-500">No assignments created yet.</p>
          ) : (
            <div className="space-y-3">
              {assignments.slice(0, 10).map(a => (
                <div key={a.id} className="border-b pb-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-gray-500">Class: {a.classes?.name || 'Unknown'} | {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/teacher/assignments/${a.id}/submissions`}
                    className="text-green-600 text-sm hover:underline">View Submissions</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
