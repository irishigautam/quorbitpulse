/**
 * GET /api/integrations/status
 * Returns connection status for all platforms for the authenticated company.
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { INTEGRATIONS } from '@/lib/integrations/registry'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { companyId } = await requireCompany()
  const supabase = createServiceClient()

  const { data: configs } = await supabase
    .from('integration_configs')
    .select('platform, status, extra_key, connected_at, expires_at, last_used_at, error_message')
    .eq('company_id', companyId)

  const configMap = new Map(
    (configs ?? []).map((c: any) => [c.platform, c])
  )

  // Merge registry defs with live status
  const statuses = INTEGRATIONS.map(def => {
    const cfg = configMap.get(def.id)
    return {
      id: def.id,
      name: def.name,
      logo: def.logo,
      color: def.color,
      connection_type: def.connection_type,
      region: def.region,
      description: def.description,
      docs_url: def.docs_url,
      feed_path: def.feed_path,
      quick_url: def.quick_url,
      key2_label: def.key2_label,
      available: def.available,
      // Live status from DB
      status: cfg?.status ?? (def.connection_type === 'feed' ? 'connected' : 'disconnected'),
      connected_at: cfg?.connected_at ?? null,
      expires_at: cfg?.expires_at ?? null,
      last_used_at: cfg?.last_used_at ?? null,
      error_message: cfg?.error_message ?? null,
      // Extra info (not the raw credentials)
      extra_key: cfg?.extra_key ?? null,
    }
  })

  return NextResponse.json({ integrations: statuses })
}
