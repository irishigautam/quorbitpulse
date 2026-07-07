'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/confirm?next=/onboarding/reset-password`,
      },
    )

    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <a href="/" className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
          JobPulse
        </a>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>by Quorbit</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        {sent ? (
          <>
            <div className="text-center mb-2">
              <div className="text-4xl mb-3">📧</div>
              <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Check your email
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                We sent a password reset link to <strong>{email}</strong>.
                Click the link in the email to set a new password.
              </p>
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => setSent(false)}
                  className="underline"
                  style={{ color: 'var(--accent)' }}
                >
                  try again
                </button>.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              Reset your password
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ background: loading ? 'var(--muted)' : 'var(--accent)' }}
              >
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          <Link href="/onboarding/login" className="underline" style={{ color: 'var(--accent)' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
