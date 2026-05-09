'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Teacher { id: string; full_name: string; email: string }

export default function CreateClassForm({ teachers }: { teachers: Teacher[] }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [description, setDescription] = useState('')
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
      const resp = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, teacherId, description }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to create class')
      setSuccess(`Class ${name} created!`)
      setName(''); setCode(''); setTeacherId(''); setDescription('')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow max-w-lg space-y-3">
      <h2 className="font-semibold text-lg">Create New Class</h2>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded text-sm">{success}</div>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Class Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required
            className="w-full p-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Code</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} required
            className="w-full p-2 border rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Teacher</label>
        <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
          className="w-full p-2 border rounded-lg text-sm">
          <option value="">Unassigned</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
          className="w-full p-2 border rounded-lg text-sm" />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition text-sm">
        {loading ? 'Creating...' : 'Create Class'}
      </button>
    </form>
  )
}
