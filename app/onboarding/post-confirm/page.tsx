'use client'

/**
 * Reached after a new employer clicks the confirmation link in their email
 * (auth/confirm/page.tsx verifies the token, sets the session, and redirects
 * here). Company details were stashed in user_metadata at signup time
 * instead of the companies table, since there was no session yet to satisfy
 * RLS. Now that a session exists, create the company row (if it doesn't
 * already exist — re-clicking an old link should be a no-op, not a
 * duplicate) and continue to payment.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PostConfirmPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function run() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/onboarding/login')
        return
      }

      // Already has a company (e.g. link clicked twice, or confirmations
      // were disabled and the row was created at signup already)?
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (existing) {
        router.replace('/onboarding/payment')
        return
      }

      const meta = user.user_metadata ?? {}
      if (!meta.company_name) {
        // Not an employer signup (or metadata missing for some reason) —
        // safest fallback is the login page rather than guessing.
        router.replace('/onboarding/login')
        return
      }

      const { error: companyError } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          name: meta.company_name,
          website: meta.website,
          careers_email: meta.careers_email ?? user.email,
        })

      if (companyError) {
        setError(companyError.message)
        return
      }

      fetch('/api/events/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'company_signup' }),
      }).catch(() => {})

      router.replace('/onboarding/payment')
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      {error ? (
        <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md text-center">
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          <a href="/onboarding/login" className="text-sm underline mt-4 inline-block" style={{ color: 'var(--accent)' }}>
            Back to sign in
          </a>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Setting up your account…</p>
      )}
    </div>
  )
}
