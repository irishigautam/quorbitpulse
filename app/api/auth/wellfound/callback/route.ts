/**
 * GET /api/auth/wellfound/callback
 *
 * OAuth callback for Wellfound (AngelList Talent).
 *
 * NOTE: Auth check is done OUTSIDE the try/catch so that NEXT_REDIRECT
 * is not swallowed. We use a direct Supabase auth check instead of
 * requireCompany() to avoid redirect() inside try/catch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=wellfound_denied`)
  }

  // ── Auth check OUTSIDE try/catch ─────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${APP_URL}/onboarding/login?redirectTo=/dashboard/integrations`
    )
  }

  // Resolve company ID
  const { data: member } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  let companyId: string | null = member?.company_id ?? null

  if (!companyId) {
    const { data: owned } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()
    companyId = owned?.id ?? null
  }

  if (!companyId) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=wellfound_no_company`
    )
  }

  // ── Token exchange + store ────────────────────────────────────────────────
  try {
    const redirectUri = `${APP_URL}/api/auth/wellfound/callback`
    const tokenRes = await fetch('https://api.wellfound.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.WELLFOUND_CLIENT_ID ?? '',
        client_secret: process.env.WELLFOUND_CLIENT_SECRET ?? '',
      }),
    })

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)

    const { access_token, expires_in, refresh_token } = await tokenRes.json()
    const expiresAt = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

    const svc = createServiceClient()
    await svc
      .from('integration_configs')
      .upsert({
        company_id: companyId,
        platform: 'wellfound',
        status: 'connected',
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,platform' })

    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?success=wellfound`)
  } catch (err) {
    console.error('[wellfound/callback]', err)
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=wellfound_failed`)
  }
}
