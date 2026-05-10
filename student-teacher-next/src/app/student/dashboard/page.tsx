'use client'

import { useEffect, useState } from 'react'
import { store } from '@/lib/store'

export default function StudentDashboard() {
  const [stats, setStats] = useState({ assignments: 0, submitted: 0, graded: 0 })

  useEffect(() => {
    const session = store.auth.session()
    if (!session) return
    const assignments = store.assignments.byClass(session.classId || 0)
    const submissions = store.submissions.byStudent(session.id)
    setStats({
      assignments: assignments.length,
      submitted: submissions.length,
      graded: submissions.filter(s => s.grade !== undefined).length,
    })
  }, [])

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Student Dashboard</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Track your assignments and grades</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'Assignments', value: stats.assignments, color: '#60a5fa' },
          { label: 'Submitted', value: stats.submitted, color: '#4ade80' },
          { label: 'Graded', value: stats.graded, color: '#eab308' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ animation: `fadeInUp 0.4s ease ${i * 0.1}s forwards`, opacity: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <a href="/student/assignments" className="card-3d" style={{ padding: 24, textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>My Assignments</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>View and submit assignments</p>
        </a>
        <a href="/student/submissions" className="card-3d" style={{ padding: 24, textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>My Submissions</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Check grades and feedback</p>
        </a>
      </div>
    </div>
  )
}
