'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { store, seedIfEmpty } from '@/lib/store'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [classes, setClasses] = useState<{ id: number; name: string; code: string }[]>([])
  const [classId, setClassId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    seedIfEmpty()
    setClasses(store.classes.all())
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }

    setLoading(true)
    const result = store.auth.register({ email, password, fullName, role, classId: classId ? Number(classId) : undefined })

    if (!result.ok) {
      setError(result.error || 'Registration failed')
      setLoading(false)
      return
    }

    setSuccess('Account created! Redirecting to login...')
    setTimeout(() => router.push('/login'), 1500)
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

      <div className="card-3d" style={{ width: '100%', maxWidth: 460, padding: 40, animation: 'fadeInUp 0.5s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>Create Account</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 6 }}>Join the Forestry Training Institute</p>
        </div>

        {error && <div style={{ background: 'rgba(153,27,27,0.3)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 20 }}>{error}</div>}
        {success && <div style={{ background: 'rgba(20,83,45,0.3)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '12px 16px', color: '#4ade80', fontSize: 14, marginBottom: 20 }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Full Name" className="input-glass" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email address" className="input-glass" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password (min 6 chars)" className="input-glass" />
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm Password" className="input-glass" />

          <select value={role} onChange={e => { setRole(e.target.value as 'student' | 'teacher'); setClassId('') }} className="input-glass">
            <option value="student">Register as Student</option>
            <option value="teacher">Register as Teacher</option>
          </select>

          {role === 'student' && (
            <select value={classId} onChange={e => setClassId(e.target.value)} required className="input-glass">
              <option value="">-- Select your class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              {classes.length === 0 && <option disabled>No classes available</option>}
            </select>
          )}

          {role === 'teacher' && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              An administrator will assign you to a class later.
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8, padding: '14px 0', width: '100%', fontSize: 16 }}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 20 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#c9973c', textDecoration: 'none', fontWeight: 600 }}>Login</a>
        </p>
      </div>
    </div>
  )
}
