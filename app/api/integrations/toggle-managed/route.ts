/**
 * POST /api/integrations/toggle-managed
 *
 * Enables or disables managed mode for a platform.
 * Managed = Quorbit's platform-level credentials post on behalf of the company.
 *
 * Body: { platform: string, enabled: boolean }
 *
 * NOTE: requireCompany() is called OUTSIDE the try/catch block so that
 * NEXT_REDIRECT (thrown on auth failure) propagates correctly to Next.js
 * instead of being caught and converted to a 500 error.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getIntegration } from '@/lib/integrations/registry'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth OUTSIDE try/catch — NEXT_REDIRECT must not be swallowed
  const { companyId } = await requireCompany()

  try {
    const { platform, enabled } = await req.json()

    if (!platform || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'platform and enabled are required' }, { status: 400 })
    }

    const def = getIntegration(platform)
    if (!def) {
      return NextResponse.json({ error: 'Unknown platform' }, { status: 404 })
    }
    if (!def.supports_managed) {
      return NextResponse.json({ error: 'Platform does not support managed mode' }, { status: 400 })
    }
    if (enabled && !def.env_key) {
      return NextResponse.json({ error: 'Managed credentials not configured on server' }, { status: 400 })
    }

    const supabase = createServiceClient()

    if (enabled) {
      await supabase.from('integration_configs').upsert({
        company_id: companyId,
        platform,
        status: 'connected',
        mode: 'managed',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,platform' })
    } else {
      const { data: existing } = await supabase
        .from('integration_configs')
        .select('mode')
        .eq('company_id', companyId)
        .eq('platform', platform)
        .single()

      if (existing?.mode === 'owned') {
        return NextResponse.json({ ok: true, note: 'owned connection unchanged' })
      }

      await supabase
        .from('integration_configs')
        .update({ mode: 'disabled', status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('platform', platform)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[toggle-managed]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
