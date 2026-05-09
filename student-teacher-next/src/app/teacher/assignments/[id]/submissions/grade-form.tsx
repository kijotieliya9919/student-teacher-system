'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GradeForm({ assignmentId, studentId, currentGrade, currentFeedback }: {
  assignmentId: number; studentId: string; currentGrade?: string; currentFeedback?: string
}) {
  const [grade, setGrade] = useState(currentGrade || '')
  const [feedback, setFeedback] = useState(currentFeedback || '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    setSaving(true)
    const res = await fetch('/api/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, studentId, grade, feedback }),
    })

    if (!res.ok) {
      const errData = await res.json()
      alert('Failed to save grade: ' + (errData.error || 'Unknown error'))
    } else {
      alert('Grade saved!')
      router.refresh()
    }
    setSaving(false)
  }

  return (
    <div className="flex gap-2 items-center">
      <input type="text" value={grade} onChange={e => setGrade(e.target.value)}
        placeholder="Grade" className="w-16 p-1 border rounded text-sm" />
      <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)}
        placeholder="Feedback" className="w-32 p-1 border rounded text-sm" />
      <button onClick={handleSubmit} disabled={saving}
        className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50">
        {saving ? '...' : 'Save'}
      </button>
    </div>
  )
}
