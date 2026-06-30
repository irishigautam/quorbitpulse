/**
 * GET  /api/team/accept-invite?token=xxx — validate token, return invite details
 * POST /api/team/accept-invite — create account (if needed) + join company
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: invite } = await supabase
    .from('company_invites')
    .select('email, role, expires_at, accepted_at, company:companies(name)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Expired' }, { status: 410 })

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    company_name: (invite.company as any)?.name ?? 'your company',
  })
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'token and password required' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: invite } = await supabase
    .from('company_invites')
    .select('id, email, role, company_id, expires_at, accepted_at')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (invite.accepted_at) return NextResponse.json({ error: 'Already accepted' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  // Create or sign in the user
  let userId: string

  const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  })

  if (signUpError) {
    // User may already exist — look them up
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const existing = users.find(u => u.email === invite.email)
    if (!existing) return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    userId = existing.id
  } else {
    userId = signUpData.user!.id
  }

  // Add to company_members
  await supabase.from('company_members').upsert({
    company_id: invite.company_id,
    user_id: userId,
    role: invite.role,
    invited_email: invite.email,
    accepted_at: new Date().toISOString(),
  }, { onConflict: 'company_id,user_id' })

  // Mark invite as accepted
  await supabase
    .from('company_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
