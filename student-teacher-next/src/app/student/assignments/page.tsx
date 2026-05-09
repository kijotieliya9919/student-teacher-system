import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SubmitButton from './submit-button'

export default async function StudentAssignments() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('class_id')
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
      .from('audit_logs')
      .select('action, details')
      .eq('user_id', user.id)
      .like('action', 'submission_%')
    submissions = s?.map(log => ({
      assignment_id: Number(log.action.replace('submission_', '')),
      grade: null,
    })) || []
  }

  const submittedMap = new Map(submissions.map(s => [s.assignment_id, s]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">My Assignments</h1>

      {!profile?.class_id ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded">
          You have not been assigned to a class yet. Contact your administrator.
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
          No assignments have been posted for your class yet.
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map(a => {
            const sub = submittedMap.get(a.id)
            const deadlinePassed = a.deadline && new Date(a.deadline) < new Date()
            return (
              <div key={a.id} className={`bg-white p-6 rounded-lg shadow ${deadlinePassed ? 'border-l-4 border-red-500' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{a.title}</h3>
                    <p className="text-gray-600 mt-1">{a.description || 'No description'}</p>
                    <div className="mt-2 text-sm text-gray-500 space-y-1">
                      <p>
                        File: {a.file_name} ({a.file_type})
                        <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${a.file_path}`}
                          target="_blank" className="ml-2 text-blue-600 hover:underline">Download</a>
                      </p>
                      {a.deadline && (
                        <p className={deadlinePassed ? 'text-red-500 font-medium' : 'text-yellow-600'}>
                          Deadline: {new Date(a.deadline).toLocaleString()}
                          {deadlinePassed ? ' (PASSED)' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    {sub ? (
                      <div>
                        <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded text-sm">Submitted</span>
                        {sub.grade && <p className="text-sm mt-1">Grade: {sub.grade}</p>}
                      </div>
                    ) : deadlinePassed ? (
                      <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded text-sm">Closed</span>
                    ) : (
                      <SubmitButton assignmentId={a.id} fileName={a.file_name} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
