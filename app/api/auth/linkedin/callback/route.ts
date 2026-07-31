/**
 * GET /api/auth/linkedin/callback
 *
 * OAuth 2.0 callback after LinkedIn authorization.
 * Exchanges the code for an access token, fetches org pages,
 * stores token + first org URN in integration_configs.
 *
 * NOTE: Auth check is done OUTSIDE the try/catch so that NEXT_REDIRECT
 * (thrown by requireCompany) is not swallowed as an error.
 * We use a direct Supabase auth check instead of requireCompany() to
 * avoid any redirect() calls inside try/catch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { exchangeLinkedInCode, getLinkedInOrgs } from '@/lib/distribution/linkedin'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=linkedin_denied`
    )
  }

  // ── Auth check OUTSIDE try/catch ─────────────────────────────────────────
  // Direct check avoids NEXT_REDIRECT being caught as an error.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(
      `${APP_URL}/onboarding/login?redirectTo=/dashboard/integrations`
    )
  }

  // Resolve company ID — try company_members first, then direct ownership
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
      `${APP_URL}/dashboard/integrations?error=linkedin_no_company`
    )
  }

  // ── Token exchange + store ────────────────────────────────────────────────
  try {
    const redirectUri = `${APP_URL}/api/auth/linkedin/callback`
    const { access_token, expires_in } = await exchangeLinkedInCode(code, redirectUri)

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Fetch org pages the user admins
    const orgs = await getLinkedInOrgs(access_token)
    const orgUrn = orgs[0]?.urn ?? null // Use first org page by default

    const svc = createServiceClient()
    await svc
      .from('integration_configs')
      .upsert({
        company_id: companyId,
        platform: 'linkedin',
        status: 'connected',
        access_token,
        extra_key: orgUrn,
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,platform' })

    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?success=linkedin`
    )
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?error=linkedin_failed`
    )
  }
}
