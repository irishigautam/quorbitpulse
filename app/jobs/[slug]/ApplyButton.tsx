'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * In-platform apply. Candidates apply on Pulse (not by clicking out to an
 * external URL/email) so every application is backed by a real
 * candidate_profiles row — that's the only way AI scoring has anything to
 * score. requireCandidate() on /api/candidate/apply redirects to
 * /candidate/login if the visitor isn't signed in as a candidate; a fetch()
 * follows that redirect silently and gets back the login page's HTML
 * instead of JSON, so we detect that case via content-type and send the
 * browser there directly (with a redirectTo back to this job).
 */
export default function ApplyButton({ jobId, jobSlug }: { jobId: string; jobSlug: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'applied' | 'already' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleApply() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/candidate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
        redirect: 'manual',
      })

      // requireCandidate() redirects unauthenticated visitors to
      // /candidate/login — with redirect: 'manual' that comes back as an
      // opaqueredirect/0 response instead of JSON.
      if (res.type === 'opaqueredirect' || res.status === 0) {
        router.push(`/candidate/login?redirectTo=${encodeURIComponent(`/jobs/${jobSlug}`)}`)
        return
      }

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        router.push(`/candidate/login?redirectTo=${encodeURIComponent(`/jobs/${jobSlug}`)}`)
        return
      }

      const data = await res.json()

      if (res.status === 409) {
        setStatus('already')
        setMessage('You already applied to this role.')
      } else if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Something went wrong. Please try again.')
      } else {
        setStatus('applied')
        setMessage('Application submitted — we\'ll be in touch if it\'s a match.')
      }
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'applied' || status === 'already') {
    return (
      <div
        className="block w-full py-3 rounded-xl text-center font-semibold text-sm"
        style={{ background: '#DCFCE7', color: '#166534' }}
      >
        ✓ {message}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleApply}
        disabled={loading}
        className="block w-full py-3 rounded-xl text-center font-semibold text-white text-sm"
        style={{ background: loading ? 'var(--muted)' : 'var(--accent)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        {loading ? 'Applying…' : 'Apply on Pulse →'}
      </button>
      {status === 'error' && (
        <p className="text-xs mt-2 text-center" style={{ color: '#DC2626' }}>{message}</p>
      )}
      <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted)' }}>
        No account? You'll be asked to create a free profile first — it takes about 2 minutes.
      </p>
    </div>
  )
}
