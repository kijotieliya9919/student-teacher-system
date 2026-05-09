'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Class { id: number; name: string; code: string }

export default function CreateUserForm({ classes }: { classes: Class[] }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('student')
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const resp = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, role, classId }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to create user')
      setSuccess(`User ${email} created successfully!`)
      setEmail(''); setPassword(''); setFullName('')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow max-w-lg space-y-3">
      <h2 className="font-semibold text-lg">Create New User</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded text-sm">{success}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
            className="w-full p-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm">
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full p-2 border rounded-lg text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full p-2 border rounded-lg text-sm" />
      </div>

      {role === 'student' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="w-full p-2 border rounded-lg text-sm">
            <option value="">No class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition text-sm">
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}
