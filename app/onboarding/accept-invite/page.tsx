/**
 * /onboarding/accept-invite?token=xxx
 * Accepts a company invite — creates account if needed, then joins company.
 */
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [state, setState] = useState<'loading' | 'form' | 'error' | 'done'>('loading')
  const [invite, setInvite] = useState<{ company_name: string; role: string; email: string } | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setState('error'); return }

    fetch(`/api/team/accept-invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setState('error'); return }
        setInvite(d)
        setState('form')
      })
      .catch(() => setState('error'))
  }, [token])

  async function handleAccept() {
    if (!token) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/team/accept-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setSubmitting(false)
      return
    }

    setState('done')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (state === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>Verifying invite…</div>
  )

  if (state === 'error') return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <p style={{ color: '#DC2626', marginBottom: '1rem' }}>This invite link is invalid or has expired.</p>
      <a href="/onboarding/signup" style={{ color: 'var(--accent)' }}>Sign up instead →</a>
    </div>
  )

  if (state === 'done') return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <p style={{ color: '#166534', fontWeight: 600, fontSize: '1.1rem' }}>✓ Joined successfully!</p>
      <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Redirecting to dashboard…</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
        Join {invite?.company_name}
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        You've been invited as a <strong>{invite?.role}</strong>. Set a password to create your account.
      </p>

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>Email</label>
          <input
            type="email"
            value={invite?.email ?? ''}
            disabled
            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.9rem', background: '#F9FAFB', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>Password</label>
          <input
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>
        {error && <p style={{ color: '#DC2626', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
        <button
          onClick={handleAccept}
          disabled={submitting || !password}
          style={{ padding: '0.7rem', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Joining…' : 'Accept & Join →'}
        </button>
      </div>
      <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginTop: '1rem' }}>
        Already have an account? <a href="/onboarding/signup" style={{ color: 'var(--accent)' }}>Sign in</a>
      </p>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)' }}>
        Pulse
      </div>
      <Suspense fallback={<div style={{ color: 'var(--muted)' }}>Loading…</div>}>
        <AcceptInviteContent />
      </Suspense>
    </div>
  )
}
