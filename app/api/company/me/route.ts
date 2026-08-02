/**
 * GET /api/company/me
 * Returns the authenticated company's row (safe fields only).
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId, role, company } = await requireCompany()

    const safe = {
      id: company.id,
      name: company.name,
      plan_active: company.plan_active,
      plan_tier: company.plan_tier,
      linkedin_org_urn: (company as any).linkedin_org_urn ?? null,
      linkedin_token_expires_at: (company as any).linkedin_token_expires_at ?? null,
      linkedin_access_token: (company as any).linkedin_access_token ? '***' : null,
      naukri_api_key: (company as any).naukri_api_key ? '***' : null,
      naukri_client_id: (company as any).naukri_client_id ? '***' : null,
    }

    // QA-audit fix: this response never included userId (or role), but
    // app/dashboard/team/page.tsx relies on meData.userId to find "myself"
    // in the members list and derive isAdmin from it. With userId always
    // undefined, that lookup could never match, so isAdmin was permanently
    // false for every admin - the invite form never rendered for anyone,
    // independent of (and in addition to) the separate members-list bug
    // fixed in /api/team/members.
    return NextResponse.json({ userId, role, company: safe })
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
