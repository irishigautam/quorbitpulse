'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Shown only when sync_status === 'stale' — see resync-distribution/route.ts */
export default function ResyncDistributionButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleResync() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch(`/api/jobs/${jobId}/resync-distribution`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error ?? 'Resync failed')
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleResync}
        disabled={loading}
        className="text-xs px-2 py-0.5 rounded-full font-medium underline"
        style={{ color: '#6D28D9', background: 'transparent', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'Resyncing…' : 'Resync all channels'}
      </button>
      {message && <span className="text-xs" style={{ color: 'var(--muted)' }}>{message}</span>}
    </span>
  )
}
