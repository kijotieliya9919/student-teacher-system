import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GradeForm from './grade-form'

export default async function AssignmentSubmissions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignment } = await supabase
    .from('assignments_new')
    .select('*, classes(name)')
    .eq('id', Number(id))
    .single()

  if (!assignment || assignment.teacher_id !== user.id) {
    return <div className="text-red-600">Assignment not found or access denied.</div>
  }

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, users!inner(full_name, email)')
    .eq('assignment_id', Number(id))
    .order('submitted_at', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-800">{assignment.title}</h1>
        <p className="text-gray-500">Class: {assignment.classes?.name} | {(submissions || []).length} submissions</p>
      </div>

      {!submissions || submissions.length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
          No submissions yet for this assignment.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Student</th>
                <th className="text-left p-3 font-medium text-gray-600">Submitted</th>
                <th className="text-left p-3 font-medium text-gray-600">File</th>
                <th className="text-left p-3 font-medium text-gray-600">Grade</th>
                <th className="text-left p-3 font-medium text-gray-600">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-3">{s.users?.full_name || 'Unknown'}</td>
                  <td className="p-3 text-sm text-gray-500">{new Date(s.submitted_at).toLocaleString()}</td>
                  <td className="p-3">
                    <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${s.file_path}`}
                      target="_blank" className="text-blue-600 hover:underline text-sm">Download</a>
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-1 rounded text-sm ${s.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {s.grade || 'Pending'}
                    </span>
                  </td>
                  <td className="p-3">
                    <GradeForm submissionId={s.id} currentGrade={s.grade} currentFeedback={s.feedback} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
