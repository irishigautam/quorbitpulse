/**
 * GET /api/auth/linkedin/callback
 *
 * OAuth 2.0 callback after LinkedIn authorization.
 * Exchanges the code for an access token, fetches org pages,
 * stores token + first org URN on the company row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { exchangeLinkedInCode, getLinkedInOrgs } from '@/lib/distribution/linkedin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/distribution?error=linkedin_denied`
    )
  }

  try {
    const { companyId } = await requireCompany()
    const supabase = createServiceClient()

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
    const { access_token, expires_in } = await exchangeLinkedInCode(code, redirectUri)

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Fetch org pages the user admins
    const orgs = await getLinkedInOrgs(access_token)
    const orgUrn = orgs[0]?.urn ?? null // Use first org page by default

    await supabase
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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=linkedin`
    )
  } catch (err) {
    console.error('[linkedin/callback]', err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/distribution?error=linkedin_failed`
    )
  }
}
