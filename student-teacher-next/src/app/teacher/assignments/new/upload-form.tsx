'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Class { id: number; name: string; code: string }

export default function UploadForm({ classes, teacherId }: { classes: Class[]; teacherId: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [classId, setClassId] = useState(classes[0]?.id || '')
  const [deadline, setDeadline] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!file) { setError('Please select a file'); setLoading(false); return }
    if (!classId) { setError('Please select a class'); setLoading(false); return }

    const allowed = ['.pdf', '.docx', '.xlsx', '.doc', '.xls']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) { setError('File type not allowed. Allowed: ' + allowed.join(', ')); setLoading(false); return }

    const filePath = `assignments/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('assignments')
      .upload(filePath, file)

    if (uploadError) {
      setError('File upload failed: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('assignments_new')
      .insert({
        title,
        description,
        file_path: filePath,
        file_name: file.name,
        file_type: ext,
        teacher_id: teacherId,
        class_id: Number(classId),
        deadline: deadline || null,
      })

    if (insertError) {
      setError('Failed to create assignment: ' + insertError.message)
      setLoading(false)
      return
    }

    alert('Assignment uploaded successfully! Students will see it immediately.')
    router.push('/teacher/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow max-w-2xl space-y-4">
      {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
        <select value={classId} onChange={e => setClassId(e.target.value)} required
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500">
          {classes.length === 0 && <option value="">No classes assigned</option>}
          {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </select>
        {classes.length === 0 && <p className="text-sm text-yellow-600 mt-1">You have no classes. Contact an admin.</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
        <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, DOC, DOCX, XLS, XLSX)</label>
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required
          accept=".pdf,.docx,.xlsx,.doc,.xls"
          className="w-full p-2 border rounded-lg" />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50 transition">
        {loading ? 'Uploading...' : 'Upload Assignment'}
      </button>
    </form>
  )
}
