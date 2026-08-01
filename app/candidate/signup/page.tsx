'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function CandidateSignupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingConfirmation, setPendingConfirmation] = useState(false)
  const [resent, setResent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    // 1. Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { user_type: 'candidate', full_name: form.full_name },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(redirectTo || '/candidate/dashboard')}`,
      },
    })

    if (authErr || !authData.user) {
      setError(authErr?.message ?? 'Signup failed')
      setLoading(false)
      return
    }

    // 2. Create candidate_profiles row (candidate_profiles has no RLS gating
    // on insert, so this succeeds whether or not a session was issued yet —
    // unlike the employer flow's `companies` insert, no session ordering
    // trick is needed here.)
    const slug = form.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 8)

    const { error: profileErr } = await supabase
      .from('candidate_profiles')
      .insert({
        user_id: authData.user.id,
        full_name: form.full_name,
        email: form.email,
        public_slug: slug,
        status: 'incomplete',
        skills: [],
        domain: [],
      })

    if (profileErr) {
      setError(profileErr.message)
      setLoading(false)
      return
    }

    // Best-effort funnel event — never blocks navigation
    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'candidate_signup', entityId: authData.user.id }),
    }).catch(() => {})

    // If email confirmation is required, signUp() returns no session — show
    // a "check your email" screen instead of pushing into the dashboard,
    // which requireCandidate() would immediately bounce out of anyway.
    if (!authData.session) {
      setPendingConfirmation(true)
      setLoading(false)
      return
    }

    router.push(redirectTo || '/candidate/dashboard')
  }

  async function handleResend() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resend({
      type: 'signup',
      email: form.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(redirectTo || '/candidate/dashboard')}` },
    })
    setResent(true)
    setLoading(false)
  }

  if (pendingConfirmation) {
    return (
      <div style={{ maxWidth: '420px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📧</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
          Check your email
        </h1>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your
          profile — then you can come back and upload your resume.
        </p>
        {resent && (
          <p style={{ color: '#15803D', background: '#F0FDF4', borderRadius: '8px', padding: '0.6rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Confirmation email resent.
          </p>
        )}
        <button
          onClick={handleResend} disabled={loading}
          style={{ fontSize: '0.85rem', color: 'var(--primary)', background: 'none', border: 'none', textDecoration: 'underline', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Sending…' : 'Resend confirmation email'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '420px', margin: '4rem auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>
        Create your candidate profile
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        One profile. Apply to any company on Quorbit. Takes about 2 minutes — just this form and a resume upload.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Full Name</label>
          <input
            required value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="Priya Sharma"
            style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Email</label>
          <input
            required type="email" value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="priya@example.com"
            style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Password</label>
          <input
            required type="password" value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Min. 8 characters"
            minLength={8}
            style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: '0.85rem' }}>{error}</p>}

        <button
          type="submit" disabled={loading}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Creating profile…' : 'Create profile'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>
        Already have a profile?{' '}
        <a href={redirectTo ? `/candidate/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/candidate/login'} style={{ color: 'var(--primary)' }}>
          Log in
        </a>
      </p>
    </div>
  )
}

export default function CandidateSignupPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: '420px', margin: '4rem auto', color: 'var(--muted)' }}>Loading…</div>}>
      <CandidateSignupContent />
    </Suspense>
  )
}
