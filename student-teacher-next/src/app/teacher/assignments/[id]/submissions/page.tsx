import { requireAuth } from '@/lib/auth'
import GradeForm from './grade-form'

export default async function AssignmentSubmissions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { svc, userId } = await requireAuth('teacher')
  const assignmentId = Number(id)

  const { data: assignment } = await svc
    .from('assignments_new')
    .select('*, classes(name)')
    .eq('id', assignmentId)
    .single()

  if (!assignment || assignment.teacher_id !== userId) {
    return <div className="text-red-600">Assignment not found or access denied.</div>
  }

  const { data: logs } = await svc
    .from('audit_logs')
    .select('*, users!inner(full_name, email)')
    .eq('action', `submission_${assignmentId}`)
    .order('timestamp', { ascending: true })

  const logsList = logs || []

  const { data: gradeLogs } = await svc
    .from('audit_logs')
    .select('*')
    .like('action', `grade_${assignmentId}_%`)

  const gradeMap = new Map<string, { grade: string; feedback: string }>()
  for (const g of gradeLogs || []) {
    const studentId = g.action.replace(`grade_${assignmentId}_`, '')
    try {
      gradeMap.set(studentId, JSON.parse(g.details || '{}'))
    } catch { gradeMap.set(studentId, { grade: '', feedback: '' }) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-800">{assignment.title}</h1>
        <p className="text-gray-500">Class: {assignment.classes?.name} | {logsList.length} submissions</p>
      </div>

      {logsList.length === 0 ? (
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
              {logsList.map((s: any) => {
                const studentId = s.user_id
                const gradeInfo = gradeMap.get(studentId) || { grade: '', feedback: '' }
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.users?.full_name || 'Unknown'}</td>
                    <td className="p-3 text-sm text-gray-500">{new Date(s.timestamp).toLocaleString()}</td>
                    <td className="p-3">
                      <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${s.details}`}
                        target="_blank" className="text-blue-600 hover:underline text-sm">Download</a>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 rounded text-sm ${gradeInfo.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {gradeInfo.grade || 'Pending'}
                      </span>
                    </td>
                    <td className="p-3">
                      <GradeForm assignmentId={assignmentId} studentId={studentId} currentGrade={gradeInfo.grade || ''} currentFeedback={gradeInfo.feedback || ''} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
