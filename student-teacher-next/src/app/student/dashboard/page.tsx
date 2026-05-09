import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('class_id, full_name')
    .eq('id', user.id)
    .single()

  let assignments: any[] = []
  let submissions: any[] = []

  if (profile?.class_id) {
    const { data: a } = await supabase
      .from('assignments_new')
      .select('*')
      .eq('class_id', profile.class_id)
      .order('created_at', { ascending: false })
    assignments = a || []

    const { data: s } = await supabase
      .from('submissions')
      .select('assignment_id, grade')
      .eq('student_id', user.id)
    submissions = s || []
  }

  const submittedIds = new Set(submissions.map(s => s.assignment_id))
  const gradedCount = submissions.filter(s => s.grade).length

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome back, {profile?.full_name || 'Student'}!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Active Assignments</h3>
          <p className="text-3xl font-bold">{assignments.length}</p>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Submitted</h3>
          <p className="text-3xl font-bold">{submittedIds.size}</p>
        </div>
        <div className="bg-yellow-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg opacity-90">Graded</h3>
          <p className="text-3xl font-bold">{gradedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Recent Assignments</h2>
          <Link href="/student/assignments" className="text-green-600 text-sm hover:underline">View all</Link>
        </div>
        <div className="p-4">
          {assignments.length === 0 ? (
            <p className="text-gray-500">No assignments yet.</p>
          ) : (
            <div className="space-y-3">
              {assignments.slice(0, 5).map(a => (
                <div key={a.id} className="border-b pb-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-gray-500">
                      {a.deadline ? `Due: ${new Date(a.deadline).toLocaleDateString()}` : 'No deadline'}
                      {submittedIds.has(a.id) && ' | ✅ Submitted'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
