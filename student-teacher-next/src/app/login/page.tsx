'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { store, seedIfEmpty } from '@/lib/store'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => { seedIfEmpty() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = store.auth.login(email, password)
    if (!result.ok) { setError(result.error); setLoading(false); return }
    if (!result.user) { setError('Login failed'); setLoading(false); return }

    if (result.user.role !== role) {
      setError('This account is not registered as a ' + role)
      setLoading(false)
      return
    }

    router.push('/' + result.user.role + '/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: 20 }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: Math.random() * 5 + 2 + 'px', height: Math.random() * 5 + 2 + 'px',
          background: 'rgba(201,151,60,' + (Math.random() * 0.3 + 0.1) + ')', borderRadius: '50%',
          left: Math.random() * 100 + '%', top: Math.random() * 100 + '%',
          animation: `float ${Math.random() * 6 + 4}s ease-in-out infinite`,
          animationDelay: Math.random() * 4 + 's',
        }} />
      ))}

      <div className="card-3d" style={{ width: '100%', maxWidth: 420, padding: 40, animation: 'fadeInUp 0.5s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #c9973c, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, color: '#0a3622', margin: '0 auto 12px' }}>FTI</div>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>Welcome Back</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 6 }}>Sign in to your account</p>
        </div>

        {error && <div style={{ background: 'rgba(153,27,27,0.3)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 20 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>I am a</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input-glass">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" className="input-glass" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 6, fontWeight: 600 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="input-glass" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8, padding: '14px 0', width: '100%', fontSize: 16 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 24 }}>
          Don&apos;t have an account?{' '}
          <a href="/register" style={{ color: '#c9973c', textDecoration: 'none', fontWeight: 600 }}>Create one</a>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textDecoration: 'none' }}>Back to Home</a>
        </p>

        <div style={{ marginTop: 24, padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Test accounts:</strong><br />
          admin@forestry.edu / admin123<br />
          teacher@forestry.edu / teacher123<br />
          student@forestry.edu / student123
        </div>
      </div>
    </div>
  )
}
