'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function JobActionsClient({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')

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

  const handlePublish = async () => {
    setPublishing(true)
    setPublishError('')
    const res = await fetch(`/api/jobs/${jobId}/publish`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setPublishError(data.error ?? 'Failed to publish')
      setPublishing(false)
      return
    }
    router.refresh()
    setPublishing(false)
  }

  return (
    <>
      <Link
        href={`/dashboard/jobs/${jobId}/edit`}
        className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition-colors"
      >
        Edit
      </Link>
      {status === 'draft' && (
        <button
          onClick={handlePublish}
          disabled={publishing}
          title={publishError || undefined}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {publishing ? 'Publishing…' : 'Publish →'}
        </button>
      )}
      {publishError && (
        <span className="text-xs text-red-600">{publishError}</span>
      )}
      {status !== 'expired' && status !== 'draft' && (
        <button
          onClick={handleExpire}
          disabled={loading}
          className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          {loading ? 'Expiring…' : 'Expire listing'}
        </button>
      )}
    </>
  )
}
