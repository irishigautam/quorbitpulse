'use client'

/**
 * Defensive fallback — requireCompany() redirects here if a session exists
 * but the email isn't confirmed. Shouldn't normally be reachable (Supabase
 * won't issue a session pre-confirmation when email confirmations are
 * enabled), but this exists as a real dead end with a real resend option
 * rather than a silent redirect loop if that assumption ever breaks.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function VerifyPendingPage() {
  const router = useRouter()
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding/post-confirm` },
      })
      setResent(true)
    }
    setLoading(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/onboarding/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md text-center">
        <div className="text-4xl mb-3">📧</div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Confirm your email to continue</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Your account needs a confirmed email address before you can access the dashboard.
        </p>
        {resent && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">Confirmation email resent.</p>
        )}
        <button onClick={handleResend} disabled={loading} className="text-sm underline block w-full mb-3" style={{ color: 'var(--accent)' }}>
          {loading ? 'Sending…' : 'Resend confirmation email'}
        </button>
        <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-gray-900">
          Sign out
        </button>
      </div>
    </div>
  )
}
