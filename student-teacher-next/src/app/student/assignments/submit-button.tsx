'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SubmitButton({ assignmentId }: { assignmentId: number; fileName: string }) {
  const [uploading, setUploading] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.xlsx,.doc,.xls,.zip,.rar,.7z'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('assignment_id', String(assignmentId))

      const res = await fetch('/api/submissions', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        alert('Upload failed: ' + (errData.error || 'Unknown error'))
      } else {
        alert('Assignment submitted successfully!')
        router.refresh()
      }
      setUploading(false)
    }
    input.click()
  }

  return (
    <button onClick={handleSubmit} disabled={uploading}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 transition text-sm">
      {uploading ? 'Uploading...' : 'Submit Work'}
    </button>
  )
}
