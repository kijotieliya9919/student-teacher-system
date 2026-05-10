'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { store, seedIfEmpty } from '@/lib/store'
import type { Submission } from '@/lib/store'

export default function GradeSubmissions() {
  const params = useParams()
  const assignmentId = Number(params.id)
  const [assignment, setAssignment] = useState(store.assignments.byId(assignmentId))
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [grades, setGrades] = useState<Record<number, { grade: string; feedback: string }>>({})

  useEffect(() => {
    seedIfEmpty()
    setAssignment(store.assignments.byId(assignmentId))
    const subs = store.submissions.byAssignment(assignmentId)
    setSubmissions(subs)
    const g: Record<number, { grade: string; feedback: string }> = {}
    subs.forEach(s => { g[s.id] = { grade: s.grade?.toString() || '', feedback: s.feedback || '' } })
    setGrades(g)
  }, [assignmentId])

  function handleGrade(subId: number) {
    const g = grades[subId]
    const gradeNum = parseInt(g.grade)
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) { alert('Grade must be 0-100'); return }
    store.submissions.grade(subId, gradeNum, g.feedback)
    setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, grade: gradeNum, feedback: g.feedback } : s))
    alert('Grade saved!')
  }

  if (!assignment) return <div className="card-3d" style={{ padding: 40, textAlign: 'center' }}><p style={{ color: 'rgba(255,255,255,0.4)' }}>Assignment not found.</p></div>

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{assignment.title}</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>{submissions.length} submission(s) — Due: {assignment.dueDate}</p>

      {submissions.length === 0 && (
        <div className="card-3d" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>No submissions yet.</p>
        </div>
      )}

      {submissions.map((s, i) => (
        <div key={s.id} className="card-3d" style={{ padding: 20, marginBottom: 16, animation: `fadeInUp 0.3s ease ${i * 0.05}s forwards`, opacity: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{s.studentName || 'Student'}</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Submitted: {s.submittedAt}</p>
              {s.fileUrl && (
                <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: 13, display: 'inline-block', marginTop: 4 }}>📎 View Submission</a>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {s.grade !== undefined ? (
                <span className={'badge ' + (s.grade >= 70 ? 'badge-green' : s.grade >= 40 ? 'badge-gold' : 'badge-red')}>{s.grade}%</span>
              ) : (
                <span className="badge badge-blue">Ungraded</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 120px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Grade (0-100)</label>
              <input type="number" min="0" max="100"
                value={grades[s.id]?.grade || ''}
                onChange={e => setGrades({ ...grades, [s.id]: { ...grades[s.id], grade: e.target.value } })}
                className="input-glass" style={{ padding: '8px 12px' }} />
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Feedback</label>
              <input type="text"
                value={grades[s.id]?.feedback || ''}
                onChange={e => setGrades({ ...grades, [s.id]: { ...grades[s.id], feedback: e.target.value } })}
                placeholder="Add feedback..." className="input-glass" style={{ padding: '8px 12px' }} />
            </div>
            <button onClick={() => handleGrade(s.id)} className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>
              Save Grade
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
