'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Query params (PKCE / token-hash flow)
    const qp          = new URLSearchParams(window.location.search)
    const token_hash  = qp.get('token_hash')
    const type        = qp.get('type')
    const next        = qp.get('next') ?? '/dashboard'

    // Hash fragment (implicit flow — Supabase appends #access_token=...)
    const hp            = new URLSearchParams(window.location.hash.slice(1))
    const access_token  = hp.get('access_token')
    const refresh_token = hp.get('refresh_token') ?? ''
    // When redirectTo already had ?next=..., Supabase may encode it inside the hash
    const hashNext = (() => {
      try {
        const rt = hp.get('redirect_to')
        if (rt) return new URL(rt).searchParams.get('next') ?? next
      } catch {}
      return next
    })()

    async function verify() {
      try {
        // 1. PKCE token-hash flow (newer Supabase email link format)
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          })
          if (!error) { router.replace(next); return }
        }

        // 2. Implicit flow (hash fragment with access_token)
        if (access_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (!error) { router.replace(hashNext); return }
        }

        // 3. Session might already be set by Supabase JS auto-exchange
        const { data: { session } } = await supabase.auth.getSession()
        if (session) { router.replace(next); return }

        // Nothing worked
        router.replace('/onboarding/login?error=link_expired')
      } catch {
        router.replace('/onboarding/login?error=link_expired')
      }
    }

    verify()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Verifying your link…</p>
    </div>
  )
}
