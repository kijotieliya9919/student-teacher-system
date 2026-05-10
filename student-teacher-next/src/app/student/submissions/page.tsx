'use client'

import { useEffect, useState } from 'react'
import { store, seedIfEmpty } from '@/lib/store'
import type { Submission } from '@/lib/store'

export default function StudentSubmissions() {
  const [submissions, setSubmissions] = useState<(Submission & { assignmentTitle?: string })[]>([])

  useEffect(() => {
    seedIfEmpty()
    const session = store.auth.session()
    if (!session) return
    const subs = store.submissions.byStudent(session.id)
    const allAssignments = store.assignments.all()
    setSubmissions(subs.map(s => ({
      ...s,
      assignmentTitle: allAssignments.find(a => a.id === s.assignmentId)?.title || 'Unknown',
    })))
  }, [])

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 28 }}>My Submissions</h1>

      {submissions.length === 0 && (
        <div className="card-3d" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>You haven't submitted any assignments yet.</p>
        </div>
      )}

      <div className="card-3d" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="table-3d">
          <thead>
            <tr><th>Assignment</th><th>Submitted</th><th>Grade</th><th>Feedback</th></tr>
          </thead>
          <tbody>
            {submissions.map(s => (
              <tr key={s.id}>
                <td style={{ color: '#fff', fontWeight: 600 }}>{s.assignmentTitle || '—'}</td>
                <td style={{ color: 'rgba(255,255,255,0.5)' }}>{s.submittedAt}</td>
                <td>
                  {s.grade !== undefined ? (
                    <span className={'badge ' + (s.grade >= 70 ? 'badge-green' : s.grade >= 40 ? 'badge-gold' : 'badge-red')}>
                      {s.grade}%
                    </span>
                  ) : (
                    <span className="badge badge-blue">Pending</span>
                  )}
                </td>
                <td style={{ color: 'rgba(255,255,255,0.6)' }}>{s.feedback || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
