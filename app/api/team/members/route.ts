/**
 * GET  /api/team/members — list all members of the authenticated company
 * DELETE /api/team/members — remove a member (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { companyId } = await requireRole('viewer')
  const supabase = createServiceClient()

  const { data: members } = await supabase
    .from('company_members')
    .select('id, user_id, role, created_at, accepted_at, invited_email, user:auth.users(email, raw_user_meta_data)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  // Also get pending invites
  const { data: invites } = await supabase
    .from('company_invites')
    .select('id, email, role, created_at, expires_at, accepted_at')
    .eq('company_id', companyId)
    .is('accepted_at', null)
    .gte('expires_at', new Date().toISOString())

  return NextResponse.json({ members: members ?? [], invites: invites ?? [] })
}

export async function DELETE(req: NextRequest) {
  const { companyId, userId: requesterId } = await requireRole('admin')
  const { user_id } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (user_id === requesterId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  return NextResponse.json({ ok: true })
}
