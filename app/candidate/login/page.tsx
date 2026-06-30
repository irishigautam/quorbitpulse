'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CandidateLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push('/candidate/dashboard')
  }

  return (
    <div style={{ maxWidth: '420px', margin: '4rem auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>
        Candidate login
      </h1>
      <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Log in to view your applications and profile.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: '0.85rem' }}>{error}</p>}

        <button
          type="submit" disabled={loading}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', textAlign: 'center' }}>
        New to Quorbit? <a href="/candidate/signup" style={{ color: 'var(--primary)' }}>Create profile</a>
      </p>
    </div>
  )
}
