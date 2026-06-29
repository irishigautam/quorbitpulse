'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JobActionsClient({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleExpire = async () => {
    if (!confirm('Mark this job as expired? It will be removed from the public board.')) return
    setLoading(true)
    await fetch('/api/jobs/expire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })
    router.refresh()
    setLoading(false)
  }

  if (status === 'expired') return null

  return (
    <button
      onClick={handleExpire}
      disabled={loading}
      className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
    >
      {loading ? 'Expiring…' : 'Expire listing'}
    </button>
  )
}
