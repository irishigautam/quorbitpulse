/**
 * GET  /api/team/members — list all members of the authenticated company
 * DELETE /api/team/members — remove a member (admin only)
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { companyId } = await requireRole('viewer')
  const supabase = createServiceClient()

  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('id, user_id, role, created_at, accepted_at, invited_email')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  // QA-audit fix: there is no foreign key from company_members.user_id to
  // auth.users, so PostgREST cannot resolve the embedded `user:auth.users(...)`
  // resource this query used to request. That made the whole select silently
  // fail (200 response, but `members` came back null/empty) even when real
  // members existed - the Team page showed "Members (0)" for every company
  // and, as a direct consequence, the admin-only invite form never rendered
  // for anyone (the client infers "am I admin?" from finding itself in this
  // same list). Fetch each member's auth user directly via the admin API
  // instead of relying on a join that has no schema relationship to resolve.
  type RawMember = {
    id: string
    user_id: string | null
    role: string
    created_at: string
    accepted_at: string | null
    invited_email: string | null
  }

  const members = await Promise.all(
    (rawMembers ?? []).map(async (m: RawMember) => {
      if (!m.user_id) return { ...m, user: undefined }
      const { data } = await supabase.auth.admin.getUserById(m.user_id)
      return {
        ...m,
        user: data?.user
          ? { email: data.user.email ?? '', raw_user_meta_data: data.user.user_metadata }
          : undefined,
      }
    }),
  )

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
  const { companyId, userId: requesterId, role: requesterRole } = await requireRole('admin')
  const { user_id } = await req.json()

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (user_id === requesterId) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase
    .from('company_members')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  after(() => logAudit({
    companyId,
    actorId: requesterId,
    actorRole: requesterRole,
    action: 'member.remove',
    targetType: 'member',
    targetId: user_id,
  }))

  return NextResponse.json({ ok: true })
}
