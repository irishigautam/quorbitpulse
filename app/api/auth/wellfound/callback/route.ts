/**
 * GET /api/auth/wellfound/callback
 * OAuth callback for Wellfound (AngelList Talent).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/integrations?error=wellfound_denied`)
  }

  try {
    const { companyId } = await requireCompany()

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

    const supabase = createServiceClient()
    await supabase
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
