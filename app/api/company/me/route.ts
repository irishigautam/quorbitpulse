/**
 * GET /api/company/me
 * Returns the authenticated company's row (safe fields only).
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { company } = await requireCompany()

    // Return only safe / non-secret fields
    const safe = {
      id: company.id,
      name: company.name,
      plan_active: company.plan_active,
      plan_tier: company.plan_tier,
      linkedin_org_urn: (company as any).linkedin_org_urn ?? null,
      linkedin_token_expires_at: (company as any).linkedin_token_expires_at ?? null,
      // Return boolean presence, not the actual token values
      linkedin_access_token: (company as any).linkedin_access_token ? '***' : null,
      naukri_api_key: (company as any).naukri_api_key ? '***' : null,
      naukri_client_id: (company as any).naukri_client_id ? '***' : null,
    }

    return NextResponse.json({ company: safe })
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
