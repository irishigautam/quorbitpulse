'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * In-platform apply. Candidates apply on Pulse (not by clicking out to an
 * external URL/email) so every application is backed by a real
 * candidate_profiles row — that's the only way AI scoring has anything to
 * score. /api/candidate/apply returns a plain 401 { error: 'not_authenticated' }
 * for a signed-out visitor (it deliberately avoids calling redirect() inside
 * the route handler — that only produces a real HTTP redirect from Server
 * Components/Actions; from a Route Handler it was getting caught and
 * returned as literal "NEXT_REDIRECT" text, which is what showed up on the
 * live page instead of a sign-in prompt). We detect that 401 here and send
 * the browser to login/signup ourselves, with a redirectTo back to this job.
 */
export default function ApplyButton({ jobId, jobSlug }: { jobId: string; jobSlug: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'applied' | 'already' | 'error'>('idle')
  const [message, setMessage] = useState('')

  // QA-audit fix: check on mount whether this candidate already applied, so
  // the button reflects reality immediately instead of only after a click
  // that gets rejected server-side as a duplicate. Best-effort - if this
  // check fails for any reason, the button just falls back to its previous
  // "Apply on Pulse" state, and the server-side duplicate check still
  // prevents a real second application either way.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/candidate/apply/status?job_id=${encodeURIComponent(jobId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!cancelled && data?.applied) {
          setStatus('already')
          setMessage('You already applied to this role.')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [jobId])

  async function handleApply() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/candidate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      })

      if (res.status === 401) {
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
