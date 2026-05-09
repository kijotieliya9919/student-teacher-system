'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('student')
  const [classes, setClasses] = useState<{ id: number; name: string; code: string }[]>([])
  const [classId, setClassId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('classes').select('id, name, code').order('name').then(({ data }) => {
      if (data) setClasses(data)
    })
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, role, classId: classId || null }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Registration failed')
      setLoading(false)
      return
    }

    setSuccess('Account created successfully! Redirecting to login...')
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-800 to-green-600">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-green-800 mb-6">Create Account</h2>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I want to register as</label>
            <select value={role} onChange={e => { setRole(e.target.value); setClassId('') }}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          {role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Your Class</label>
              <select value={classId} onChange={e => setClassId(e.target.value)} required
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                <option value="">-- Select a class --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code || 'No code'})</option>
                ))}
              </select>
              {classes.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">No classes available yet. Contact admin.</p>
              )}
            </div>
          )}

          {role === 'teacher' && (
            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
              Teachers can register now. An administrator will assign you to a class later.
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-green-600 hover:underline">Login here</a>
        </p>
      </div>
    </div>
  )
}
