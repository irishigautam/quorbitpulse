/**
 * POST /api/team/invite — send an email invite to join the company (admin only)
 * DELETE /api/team/invite — revoke a pending invite
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'
import { logEvent } from '@/lib/analytics/log-event'
import { REPLY_TO_EMAIL } from '@/lib/resend'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'

export async function POST(req: NextRequest) {
  // QA-audit fix: this handler already destructures `userId` from
  // requireRole() below, but further down it re-derived the actor id via
  // `(await supabase.auth.getUser())` on the service-role client - which has
  // no session/cookie context, so that call always resolved to a null user.
  // company_invites.invited_by is NOT NULL with no default, so every single
  // invite attempt failed the not-null constraint and 500'd, unconditionally.
  const { companyId, company, userId, role: requesterRole } = await requireRole('admin')
  const { email, role } = await req.json()

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })
  if (!['recruiter', 'viewer'].includes(role ?? 'recruiter')) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check if user already a member
  const { data: existing } = await supabase
    .from('company_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('invited_email', email)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already a member or invited' }, { status: 409 })

  // Upsert invite
  const { data: invite, error } = await supabase
    .from('company_invites')
    .upsert({
      company_id: companyId,
      email,
      role: role ?? 'recruiter',
      invited_by: userId,
    }, { onConflict: 'company_id,email' })
    .select('token, last_sent_at')
    .single()

  if (error || !invite) return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })

  const inviteUrl = `${APP_URL}/onboarding/accept-invite?token=${invite.token}`

  // Retry-safety: the DB write above is already deduped (upsert onConflict),
  // but without this check the email send below would fire again on every
  // retry of an identical request (network timeout, accidental
  // double-submit) even though no new invite was actually created. Skip the
  // resend if one went out in the last 30 seconds - almost certainly a
  // retry, not a deliberate second invite - while still allowing a genuine
  // later re-invite (e.g. the admin re-inviting after the original expired).
  const recentlySent = invite.last_sent_at &&
    Date.now() - new Date(invite.last_sent_at).getTime() < 30_000

  if (!recentlySent) {
    await resend.emails.send({
      from: 'Pulse by Quorbit <noreply@thequorbit.com>',
      replyTo: REPLY_TO_EMAIL,
      to: email,
      subject: `You're invited to join ${company.name} on Pulse`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <h2 style="margin:0 0 1rem">You've been invited</h2>
          <p>${company.name} has invited you to join their team on Pulse as a <strong>${role ?? 'recruiter'}</strong>.</p>
          <a href="${inviteUrl}" style="display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#4F46E5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Accept Invitation →
          </a>
          <p style="margin-top:1.5rem;font-size:0.8rem;color:#6B7280">This invite expires in 7 days. If you didn't expect this, you can ignore it.</p>
        </div>
      `,
    })
    await supabase
      .from('company_invites')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('email', email)
  }

  after(async () => {
    await Promise.allSettled([
      logAudit({
        companyId,
        actorId: userId,
        actorRole: requesterRole,
        action: 'member.invite',
        targetType: 'invite',
        metadata: { email, role: role ?? 'recruiter' },
      }),
      logEvent({ eventType: 'invite_sent', companyId, entityId: invite.token, metadata: { email, role: role ?? 'recruiter' } }),
    ])
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { companyId, userId, role: requesterRole } = await requireRole('admin')
  const { invite_id } = await req.json()

  if (!invite_id) return NextResponse.json({ error: 'invite_id required' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase
    .from('company_invites')
    .delete()
    .eq('id', invite_id)
    .eq('company_id', companyId)

  after(() => logAudit({
    companyId,
    actorId: userId,
    actorRole: requesterRole,
    action: 'member.invite_revoke',
    targetType: 'invite',
    targetId: invite_id,
  }))

  return NextResponse.json({ ok: true })
}
