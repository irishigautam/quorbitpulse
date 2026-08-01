/**
 * PATCH /api/team/members/role — change a member's role (admin only)
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const { companyId, userId: requesterId, role: requesterRole } = await requireRole('admin')
  const { user_id, role } = await req.json()

  if (!user_id || !role) return NextResponse.json({ error: 'user_id and role required' }, { status: 400 })
  if (!['admin', 'recruiter', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (user_id === requesterId) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: prior } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user_id)
    .single()

  await supabase
    .from('company_members')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  after(() => logAudit({
    companyId,
    actorId: requesterId,
    actorRole: requesterRole,
    action: 'member.role_change',
    targetType: 'member',
    targetId: user_id,
    metadata: { from_role: prior?.role ?? null, to_role: role },
  }))

  return NextResponse.json({ ok: true })
}
