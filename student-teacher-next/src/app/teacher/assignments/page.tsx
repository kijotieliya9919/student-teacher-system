'use client'

import { useEffect, useState } from 'react'
import { store, seedIfEmpty } from '@/lib/store'
import type { Assignment } from '@/lib/store'

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState<(Assignment & { submissionCount: number })[]>([])

  useEffect(() => {
    seedIfEmpty()
    const all = store.assignments.all()
    const subs = store.submissions.all()
    setAssignments(all.map(a => ({
      ...a,
      submissionCount: subs.filter(s => s.assignmentId === a.id).length,
    })))
  }, [])

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>All Assignments</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>{assignments.length} total</p>

      {assignments.length === 0 && (
        <div className="card-3d" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>No assignments created yet.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {assignments.map((a, i) => (
          <div key={a.id} className="card-3d" style={{ padding: 20, animation: `fadeInUp 0.3s ease ${i * 0.05}s forwards`, opacity: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{a.title}</h3>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  <span>Class: {store.classes.byId(a.classId)?.name || '—'}</span>
                  <span>Due: {a.dueDate}</span>
                  <span>{a.submissionCount} submission(s)</span>
                </div>
              </div>
              <a href={'/teacher/assignments/' + a.id + '/submissions'} className="btn-primary" style={{ padding: '8px 20px', fontSize: 14, textDecoration: 'none' }}>
                Grade ({a.submissionCount})
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
