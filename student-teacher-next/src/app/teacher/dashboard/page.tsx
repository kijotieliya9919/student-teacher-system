'use client'

import { useEffect, useState } from 'react'
import { store } from '@/lib/store'

export default function TeacherDashboard() {
  const [assignments, setAssignments] = useState(0)

  useEffect(() => {
    setAssignments(store.assignments.all().length)
  }, [])

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Teacher Dashboard</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Manage your class assignments</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
        <div className="stat-card">
          <div style={{ fontSize: 32, fontWeight: 800, color: '#4ade80', marginBottom: 4 }}>{assignments}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Total Assignments</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <a href="/teacher/assignments/new" className="card-3d" style={{ padding: 24, textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>Upload Assignment</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Create new assignments for your class</p>
        </a>
      </div>
    </div>
  )
}
