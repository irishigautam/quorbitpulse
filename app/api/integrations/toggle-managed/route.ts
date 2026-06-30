/**
 * POST /api/integrations/toggle-managed
 *
 * Enables or disables managed mode for a platform.
 * Managed = Quorbit's platform-level credentials post on behalf of the company.
 *
 * Body: { platform: string, enabled: boolean }
 *
 * If enabling:
 *   - Upserts integration_configs row with mode='managed', status='connected'
 * If disabling:
 *   - Sets mode='disabled', status='disconnected' (unless they have an owned connection)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getIntegration } from '@/lib/integrations/registry'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await requireCompany()
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
      // Enable managed mode — upsert as managed/connected
      await supabase.from('integration_configs').upsert({
        company_id: companyId,
        platform,
        status: 'connected',
        mode: 'managed',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id,platform' })
    } else {
      // Disable managed mode — check if they have an owned connection first
      const { data: existing } = await supabase
        .from('integration_configs')
        .select('mode')
        .eq('company_id', companyId)
        .eq('platform', platform)
        .single()

      if (existing?.mode === 'owned') {
        // Don't touch their owned connection — they're just opting out of managed
        // (managed doesn't apply to owned anyway, so this is a no-op)
        return NextResponse.json({ ok: true, note: 'owned connection unchanged' })
      }

      // Remove or disable the managed row
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
