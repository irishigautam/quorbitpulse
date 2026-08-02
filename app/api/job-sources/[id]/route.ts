/**
 * PATCH /api/job-sources/[id]  — toggle active / update
 * DELETE /api/job-sources/[id] — remove source
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-auth'

// QA-audit fix: see app/api/job-sources/route.ts for the full explanation -
// this is a shared, platform-wide resource with no per-company scoping, so
// it's gated to the same admin allowlist used by /admin instead.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireCompany()
  const denied = await requireAdmin()
  if (denied) return denied

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('career_page_sources')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireCompany()
  const denied = await requireAdmin()
  if (denied) return denied

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('career_page_sources')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
