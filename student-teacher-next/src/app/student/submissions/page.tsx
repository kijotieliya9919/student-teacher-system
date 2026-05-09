import { requireAuth } from '@/lib/auth'

export default async function StudentSubmissions() {
  const { svc, userId } = await requireAuth('student')

  const { data: logs } = await svc
    .from('audit_logs')
    .select('*')
    .eq('user_id', user.id)
    .like('action', 'submission_%')
    .order('timestamp', { ascending: false })

  const submissionLogs = logs || []

  const assignmentIds = [...new Set(submissionLogs.map(l => Number(l.action.replace('submission_', ''))))]

  const assignmentsMap = new Map<number, any>()
  if (assignmentIds.length > 0) {
    const { data: assignments } = await svc
      .from('assignments_new')
      .select('id, title')
      .in('id', assignmentIds)
    if (assignments) {
      assignments.forEach(a => assignmentsMap.set(a.id, a))
    }
  }

  const gradeMap = new Map<string, { grade: string; feedback: string }>()
  const { data: gradeLogs } = await svc
    .from('audit_logs')
    .select('*')
    .eq('user_id', user.id)
    .like('action', 'grade_%')
  for (const g of gradeLogs || []) {
    try {
      gradeMap.set(g.action, JSON.parse(g.details || '{}'))
    } catch { gradeMap.set(g.action, { grade: '', feedback: '' }) }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">My Submissions</h1>

      {submissionLogs.length === 0 ? (
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
              {submissionLogs.map(s => {
                const assignmentId = Number(s.action.replace('submission_', ''))
                const assignment = assignmentsMap.get(assignmentId)
                const gradeInfo = gradeMap.get(`grade_${assignmentId}_${user.id}`) || { grade: '', feedback: '' }
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{assignment?.title || 'Unknown'}</td>
                    <td className="p-3 text-sm text-gray-500">
                      {new Date(s.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 rounded text-sm ${gradeInfo.grade ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {gradeInfo.grade || 'Pending'}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{gradeInfo.feedback || '-'}</td>
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
