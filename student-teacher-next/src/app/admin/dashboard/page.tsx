'use client'

import { useEffect, useState } from 'react'
import { store } from '@/lib/store'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, teachers: 0, students: 0, classes: 0 })

  useEffect(() => {
    const users = store.users.all()
    setStats({
      users: users.length,
      teachers: users.filter(u => u.role === 'teacher').length,
      students: users.filter(u => u.role === 'student').length,
      classes: store.classes.all().length,
    })
  }, [])

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Admin Dashboard</h1>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Manage your institute</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 40 }}>
        {[
          { label: 'Total Users', value: stats.users, color: '#60a5fa' },
          { label: 'Teachers', value: stats.teachers, color: '#4ade80' },
          { label: 'Students', value: stats.students, color: '#eab308' },
          { label: 'Classes', value: stats.classes, color: '#f87171' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ animation: `fadeInUp 0.4s ease ${i * 0.1}s forwards`, opacity: 0 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <a href="/admin/users" className="card-3d" style={{ padding: 24, textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👥</div>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>Manage Users</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Create & manage accounts</p>
        </a>
        <a href="/admin/classes" className="card-3d" style={{ padding: 24, textDecoration: 'none', display: 'block' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏫</div>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 4px' }}>Manage Classes</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Create & organize classes</p>
        </a>
      </div>
    </div>
  )
}
