'use client'

import { useEffect, useState } from 'react'
import { store, seedIfEmpty } from '@/lib/store'

export default function Home() {
  const [session, setSession] = useState(store.auth.session())

  useEffect(() => { seedIfEmpty() }, [])

  const handleLogout = () => {
    store.auth.logout()
    setSession(null)
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: Math.random() * 6 + 2 + 'px',
            height: Math.random() * 6 + 2 + 'px',
            background: 'rgba(201,151,60,' + (Math.random() * 0.3 + 0.1) + ')',
            borderRadius: '50%',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            animation: `float ${Math.random() * 6 + 4}s ease-in-out infinite`,
            animationDelay: Math.random() * 4 + 's',
          }} />
        ))}
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: 'rgba(10,54,34,0.6)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #c9973c, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, color: '#0a3622' }}>FTI</div>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>Forestry Training Inst.</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {session ? (
            <>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{session.fullName} ({session.role})</span>
              <a href={'/' + session.role + '/dashboard'} className="btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>Dashboard</a>
              <button onClick={handleLogout} className="btn-secondary" style={{ padding: '8px 20px', fontSize: 14 }}>Logout</button>
            </>
          ) : (
            <>
              <a href="/login" className="btn-secondary" style={{ padding: '8px 20px', fontSize: 14, textDecoration: 'none' }}>Login</a>
              <a href="/register" className="btn-primary" style={{ padding: '8px 20px', fontSize: 14, textDecoration: 'none' }}>Get Started</a>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 80px)', textAlign: 'center', padding: '0 24px' }}>
        <div className="animate-fade-in" style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 16, background: 'linear-gradient(135deg, #fff 30%, #c9973c 70%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Forestry Training Institute
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.3rem)', color: 'rgba(255,255,255,0.6)', marginBottom: 40, lineHeight: 1.6 }}>
            A modern student-teacher assignment system for the Forestry Training Institute Olmotonyi. <br />Submit assignments, track grades, and manage classes.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/login" className="btn-primary" style={{ padding: '14px 32px', fontSize: 16, textDecoration: 'none' }}>Login to Continue</a>
            <a href="/register" className="btn-secondary" style={{ padding: '14px 32px', fontSize: 16, textDecoration: 'none' }}>Create Account</a>
          </div>
        </div>

        {/* 3D Feature Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, maxWidth: 800, width: '100%', marginTop: 80 }}>
          {[
            { icon: '📚', title: 'Assignments', desc: 'Upload and submit class assignments' },
            { icon: '📊', title: 'Grades', desc: 'Track your performance and feedback' },
            { icon: '👥', title: 'Classes', desc: 'Manage students and class groups' },
          ].map((item, i) => (
            <div key={i} className="card-3d" style={{ padding: 28, animation: `fadeInUp 0.5s ease ${i * 0.15}s forwards`, opacity: 0 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
