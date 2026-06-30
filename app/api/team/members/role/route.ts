/**
 * PATCH /api/team/members/role — change a member's role (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const { companyId, userId: requesterId } = await requireRole('admin')
  const { user_id, role } = await req.json()

  if (!user_id || !role) return NextResponse.json({ error: 'user_id and role required' }, { status: 400 })
  if (!['admin', 'recruiter', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (user_id === requesterId) return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase
    .from('company_members')
    .update({ role })
    .eq('company_id', companyId)
    .eq('user_id', user_id)

  return NextResponse.json({ ok: true })
}
