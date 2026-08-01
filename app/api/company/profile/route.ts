/**
 * PATCH /api/company/profile — P0-002
 *
 * The employer's company website/name/careers_email/logo/description were
 * captured once at signup with no way to view or edit them afterward — no
 * route existed for this at all (confirmed via repo search while auditing
 * the P0 checklist). Admin-only, since this affects the whole organization
 * (distributed job postings show this info, careers_email may route
 * applications).
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

function isValidUrl(url: string) {
  try { new URL(url.startsWith('http') ? url : `https://${url}`); return true }
  catch { return false }
}

export async function PATCH(req: NextRequest) {
  const { userId, companyId, company, role } = await requireRole('admin')
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Company name cannot be empty' }, { status: 400 })
    before.name = company.name
    updates.name = name
  }

  if (typeof body.website === 'string') {
    if (!isValidUrl(body.website)) return NextResponse.json({ error: 'Enter a valid website URL' }, { status: 400 })
    before.website = company.website
    updates.website = body.website.startsWith('http') ? body.website : `https://${body.website}`
  }

  if (typeof body.careers_email === 'string') {
    if (!body.careers_email.includes('@')) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    before.careers_email = company.careers_email
    updates.careers_email = body.careers_email.trim()
  }

  if (typeof body.logo_url === 'string') {
    if (body.logo_url && !isValidUrl(body.logo_url)) return NextResponse.json({ error: 'Enter a valid logo URL' }, { status: 400 })
    before.logo_url = company.logo_url
    updates.logo_url = body.logo_url.trim() || null
  }

  if (typeof body.description === 'string') {
    before.description = company.description
    updates.description = body.description.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: updated, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update company profile' }, { status: 500 })
  }

  after(() => logAudit({
    companyId,
    actorId: userId,
    actorRole: role,
    action: 'company.profile_update',
    targetType: 'company',
    targetId: companyId,
    metadata: { before, after: updates },
  }))

  return NextResponse.json({ success: true, company: updated })
}
