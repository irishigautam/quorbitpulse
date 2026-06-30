'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CandidateSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    // 1. Create Supabase auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { user_type: 'candidate', full_name: form.full_name } },
    })

    if (authErr || !authData.user) {
      setError(authErr?.message ?? 'Signup failed')
      setLoading(false)
      return
    }

    // 2. Create candidate_profiles row
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

    router.push('/candidate/dashboard')
  }

  return (
    <div style={{ maxWidth: '420px', margin: '4rem auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>
        Create your candidate profile
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        One profile. Apply to any company on Quorbit.
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
        Already have a profile? <a href="/candidate/login" style={{ color: 'var(--primary)' }}>Log in</a>
      </p>
    </div>
  )
}
