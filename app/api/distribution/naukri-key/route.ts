/**
 * POST /api/distribution/naukri-key
 * Save Naukri API key + client ID for this company.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { companyId } = await requireCompany()
  const { api_key, client_id } = await req.json()

  if (!api_key || !client_id) {
    return NextResponse.json({ error: 'api_key and client_id are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('companies')
    .update({ naukri_api_key: api_key, naukri_client_id: client_id })
    .eq('id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest) {
  const { companyId } = await requireCompany()
  const supabase = createServiceClient()

  await supabase
    .from('companies')
    .update({ naukri_api_key: null, naukri_client_id: null })
    .eq('id', companyId)

  return NextResponse.json({ success: true })
}
