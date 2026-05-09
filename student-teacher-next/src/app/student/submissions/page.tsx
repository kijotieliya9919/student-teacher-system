import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentSubmissions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, assignments_new!inner(title, deadline)')
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">My Submissions</h1>

      {!submissions || submissions.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
          You have not submitted any assignments yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Assignment</th>
                <th className="text-left p-3 font-medium text-gray-600">Submitted</th>
                <th className="text-left p-3 font-medium text-gray-600">Grade</th>
                <th className="text-left p-3 font-medium text-gray-600">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{s.assignments_new?.title || 'Unknown'}</td>
                  <td className="p-3 text-sm text-gray-500">
                    {new Date(s.submitted_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-1 rounded text-sm ${s.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {s.grade || 'Pending'}
                    </span>
                  </td>
                  <td className="p-3 text-sm">{s.feedback || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
