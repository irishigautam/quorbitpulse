'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Mode = 'password' | 'magic'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode]           = useState<Mode>('password')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [magicSent, setMagicSent] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'link_expired') {
      setError('That link has expired or already been used. Request a new one below.')
    }
  }, [])

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) {
      setLoading(false)
      const msg = authError.message || ''
      if (!msg || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Incorrect email or password.')
      } else if (msg.toLowerCase().includes('confirm') || msg.toLowerCase().includes('verified')) {
        setError('Please confirm your email address before signing in.')
      } else {
        setError(msg || 'Sign in failed. Please try again.')
      }
      return
    }
    router.push('/dashboard')
  }

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setMagicSent(true)
  }

  if (magicSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="mb-8 text-center">
          <a href="/" className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>JobPulse</a>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>by Quorbit</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Check your email</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            We sent a sign-in link to <strong>{email}</strong>. Click it to sign in — no password needed.
          </p>
          <button onClick={() => { setMagicSent(false); setMode('password') }} className="text-xs underline" style={{ color: 'var(--accent)' }}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <a href="/" className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>JobPulse</a>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>by Quorbit</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Sign in to your account</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>Welcome back. Choose how you’d like to sign in.</p>

        {/* Mode toggle */}
        <div className="flex rounded-lg border overflow-hidden mb-5">
          <button
            onClick={() => { setMode('password'); setError('') }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{ background: mode === 'password' ? 'var(--accent)' : 'transparent', color: mode === 'password' ? '#fff' : 'var(--muted)' }}
          >
            Password
          </button>
          <button
            onClick={() => { setMode('magic'); setError('') }}
            className="flex-1 py-2 text-sm font-medium transition-colors"
            style={{ background: mode === 'magic' ? 'var(--accent)' : 'transparent', color: mode === 'magic' ? '#fff' : 'var(--muted)' }}
          >
            Magic link
          </button>
        </div>

        {mode === 'password' ? (
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="careers@acme.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: loading ? 'var(--muted)' : 'var(--accent)' }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
            <p className="text-right text-xs">
              <Link href="/onboarding/forgot-password" style={{ color: 'var(--accent)' }}>Forgot password?</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleMagic} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="careers@acme.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required autoFocus />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: loading ? 'var(--muted)' : 'var(--accent)' }}>
              {loading ? 'Sending…' : 'Send magic link →'}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>We’ll email you a one-click sign-in link.</p>
          </form>
        )}

        <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/onboarding/signup" className="underline" style={{ color: 'var(--accent)' }}>Create one</Link>
        </p>
      </div>
    </div>
  )
}
