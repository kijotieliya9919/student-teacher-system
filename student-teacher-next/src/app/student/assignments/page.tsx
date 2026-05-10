'use client'

import { useEffect, useState } from 'react'
import { store, seedIfEmpty } from '@/lib/store'
import type { Assignment, Submission } from '@/lib/store'

export default function StudentAssignments() {
  const [session, setSession] = useState(store.auth.session())
  const [assignments, setAssignments] = useState<(Assignment & { submitted?: boolean; grade?: number })[]>([])
  const [submitting, setSubmitting] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    seedIfEmpty()
    const s = store.auth.session()
    setSession(s)
    if (!s) return
    const list = store.assignments.byClass(s.classId || 0)
    const subs = store.submissions.byStudent(s.id)
    setAssignments(list.map(a => ({
      ...a,
      submitted: subs.some(sub => sub.assignmentId === a.id),
      grade: subs.find(sub => sub.assignmentId === a.id)?.grade,
    })))
  }, [])

  async function handleSubmit(assignmentId: number) {
    if (!file || !session) return
    await store.submissions.submit({
      assignmentId,
      studentId: session.id,
      studentName: session.fullName,
      file,
    })
    setSubmitting(null)
    setFile(null)
    // Refresh
    const subs = store.submissions.byStudent(session.id)
    setAssignments(prev => prev.map(a => ({
      ...a,
      submitted: subs.some(sub => sub.assignmentId === a.id),
      grade: subs.find(sub => sub.assignmentId === a.id)?.grade,
    })))
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 28 }}>My Assignments</h1>

      {assignments.length === 0 && (
        <div className="card-3d" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>No assignments available for your class yet.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {assignments.map((a, i) => (
          <div key={a.id} className="card-3d" style={{ padding: 24, animation: `fadeInUp 0.3s ease ${i * 0.05}s forwards`, opacity: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{a.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: '0 0 8px', lineHeight: 1.5 }}>{a.description}</p>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                  <span>Due: {a.dueDate}</span>
                  {a.fileUrl && <span>📎 Has attachment</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {a.submitted ? (
                  <span className="badge badge-green">
                    {a.grade !== undefined ? `Graded: ${a.grade}%` : 'Submitted'}
                  </span>
                ) : (
                  <button onClick={() => setSubmitting(a.id)} className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>
                    Submit
                  </button>
                )}
              </div>
            </div>

            {submitting === a.id && (
              <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="input-glass" style={{ marginBottom: 12, padding: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleSubmit(a.id)} disabled={!file} className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>
                    Upload
                  </button>
                  <button onClick={() => { setSubmitting(null); setFile(null) }} className="btn-secondary" style={{ padding: '8px 20px', fontSize: 14 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
