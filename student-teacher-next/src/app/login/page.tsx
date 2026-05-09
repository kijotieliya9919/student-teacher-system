'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !authData.user) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role, must_change_password')
      .eq('id', authData.user.id)
      .single()

    if (!profile) {
      await supabase.auth.signOut()
      setError('User account not set up. Contact admin.')
      setLoading(false)
      return
    }

    if (profile.role !== role) {
      await supabase.auth.signOut()
      setError(`This account is not registered as a ${role}. Please use the correct login page.`)
      setLoading(false)
      return
    }

    if (profile.must_change_password) {
      window.location.href = '/login?change_password=true'
      return
    }

    window.location.href = `/${role}/dashboard`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-800 to-green-600">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-green-800 mb-6">Login</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </select>
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
          <button type="submit" disabled={loading}
            className="w-full py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account? <a href="/register" className="text-green-600 hover:underline font-medium">Create one</a>
        </p>
        <p className="text-center text-sm text-gray-500 mt-2">
          <a href="/" className="text-green-600 hover:underline">Back to Home</a>
        </p>
      </div>
    </div>
  );
}
