'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SubmitButton({ assignmentId, fileName }: { assignmentId: number; fileName: string }) {
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.xlsx,.doc,.xls,.zip,.rar,.7z'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const filePath = `submissions/${user.id}_${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, file)

      if (uploadError) {
        alert('Upload failed: ' + uploadError.message)
        setUploading(false)
        return
      }

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, assignment_id: assignmentId, file_path: filePath }),
      })

      if (!res.ok) {
        const errData = await res.json()
        alert('Submission failed: ' + (errData.error || 'Unknown error'))
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
