/**
 * POST /api/distribution/linkedin-disconnect
 * Revoke and clear stored LinkedIn token.
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { companyId } = await requireCompany()
  const supabase = createServiceClient()

  await supabase
    .from('companies')
    .update({
      linkedin_access_token: null,
      linkedin_org_urn: null,
      linkedin_token_expires_at: null,
    })
    .eq('id', companyId)

  return NextResponse.json({ success: true })
}
