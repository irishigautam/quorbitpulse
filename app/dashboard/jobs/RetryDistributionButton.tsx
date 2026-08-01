'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RetryDistributionButton({ jobId, failedCount }: { jobId: string; failedCount: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleRetry() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry-distribution`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Retry failed')
      } else if (data.retried.length === 0) {
        setMessage('Nothing to retry')
      } else {
        const stillFailed = data.retried.filter((ch: string) => data.report[ch]?.status !== 'ok')
        setMessage(stillFailed.length === 0 ? '✓ All retried channels succeeded' : `${stillFailed.length} still failing`)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (failedCount === 0) return null

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="text-xs px-2 py-0.5 rounded-full font-medium underline"
        style={{ color: '#991B1B', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'Retrying…' : 'Retry failed channels'}
      </button>
      {message && <span className="text-xs" style={{ color: 'var(--muted)' }}>{message}</span>}
    </span>
  )
}
