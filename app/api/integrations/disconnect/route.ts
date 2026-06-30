/**
 * POST /api/integrations/disconnect
 * Disconnect any integration by platform ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { companyId } = await requireCompany()
  const { platform } = await req.json()

  if (!platform) {
    return NextResponse.json({ error: 'platform is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  await supabase
    .from('integration_configs')
    .upsert({
      company_id: companyId,
      platform,
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      api_key: null,
      extra_key: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,platform' })

  return NextResponse.json({ success: true })
}
