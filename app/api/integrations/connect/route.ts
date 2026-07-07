/**
 * POST /api/integrations/connect
 * Save API key credentials for api_key-type integrations (Naukri, Shine, TimesJobs, ZipRecruiter).
 * OAuth integrations (LinkedIn, Wellfound) use their own /api/auth/[platform]/callback routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getIntegration } from '@/lib/integrations/registry'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { companyId } = await requireCompany()
  const { platform, api_key, extra_key } = await req.json()

  if (!platform || !api_key) {
    return NextResponse.json({ error: 'platform and api_key are required' }, { status: 400 })
  }

  const def = getIntegration(platform)
  if (!def || def.connection_type !== 'api_key') {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('integration_configs')
    .upsert({
      company_id: companyId,
      platform,
      status: 'connected',
      mode: 'owned',
      api_key,
      extra_key: extra_key ?? null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,platform' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
