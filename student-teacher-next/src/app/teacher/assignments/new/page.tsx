'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { store } from '@/lib/store'

export default function NewAssignment() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classId, setClassId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [classes, setClasses] = useState<{ id: number; name: string; code: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => { setClasses(store.classes.all()) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!classId) { setMessage('Select a class'); return }
    setLoading(true)
    setMessage('')

    await store.assignments.create({
      title,
      description,
      classId: Number(classId),
      file: file || undefined,
      dueDate,
    })

    setMessage('Assignment created!')
    setTimeout(() => router.push('/teacher/dashboard'), 1500)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease', maxWidth: 600 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 28 }}>Upload Assignment</h1>

      {message && (
        <div style={{ background: message.includes('!') ? 'rgba(20,83,45,0.3)' : 'rgba(153,27,27,0.3)', border: '1px solid ' + (message.includes('!') ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'), borderRadius: 10, padding: '12px 16px', color: message.includes('!') ? '#4ade80' : '#f87171', fontSize: 14, marginBottom: 20 }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card-3d" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Assignment Title" className="input-glass" />

        <textarea value={description} onChange={e => setDescription(e.target.value)} required placeholder="Description / Instructions" className="input-glass" style={{ minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} />

        <select value={classId} onChange={e => setClassId(e.target.value)} required className="input-glass">
          <option value="">-- Select class --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </select>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="input-glass" />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Attachment (optional)</label>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="input-glass" style={{ padding: 8 }} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '14px 0', width: '100%', fontSize: 16, marginTop: 8 }}>
          {loading ? 'Uploading...' : 'Create Assignment'}
        </button>
      </form>
    </div>
  )
}
