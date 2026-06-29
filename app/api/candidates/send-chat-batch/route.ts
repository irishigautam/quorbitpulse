/**
 * POST /api/candidates/send-chat-batch
 *
 * Sends AI chat invites to the top-N scored candidates for a job
 * who don't already have an active or pending session.
 *
 * Body: { job_id: string, limit?: number }   (limit default 5, max 20)
 *
 * Returns:
 *   { sent: number, skipped: number, results: { candidate_id, name, status, error? }[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createChatToken } from '@/lib/chat/token'
import { Resend } from 'resend'
import { LIMITS, rateLimitResponse } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY || 'RESEND_API_KEY_NOT_SET')
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pulse.thequorbit.com'
const MAX_LIMIT = 20
const DEFAULT_LIMIT = 5

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()

    // Rate limit: max 3 batch sends per hour per company
    const rl = LIMITS.sendChat(company.id + ':batch')
    if (!rl.allowed) return rateLimitResponse(rl)

    const body = await req.json()
    const { job_id, limit: rawLimit } = body

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const limit = Math.min(Math.max(1, Number(rawLimit) || DEFAULT_LIMIT), MAX_LIMIT)

    const supabase = createServiceClient()

    // Verify job belongs to company
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('id', job_id)
      .eq('company_id', company.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Get top-N scored candidates for this job who don't have an active/pending session
    // We join candidate_job_assignments to find candidates assigned to this job,
    // then exclude any who already have a chat session that's active or pending.
    const { data: candidates, error: candError } = await supabase
      .from('imported_candidates')
      .select('id, full_name, email')
      .eq('company_id', company.id)
      .not('match_score', 'is', null)
      .order('match_score', { ascending: false })
      .limit(limit * 3) // fetch extra to account for skips

    if (candError) {
      return NextResponse.json({ error: candError.message }, { status: 500 })
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, results: [], message: 'No scored candidates found.' })
    }

    // Get existing active/pending sessions for this job to exclude
    const candidateIds = candidates.map(c => c.id)
    const { data: existingSessions } = await supabase
      .from('chat_sessions')
      .select('candidate_id, status')
      .eq('job_id', job_id)
      .eq('company_id', company.id)
      .in('status', ['pending', 'active', 'completed'])
      .in('candidate_id', candidateIds)

    const alreadySent = new Set((existingSessions ?? []).map(s => s.candidate_id))

    // Filter to eligible candidates and take top limit
    const eligible = candidates.filter(c => !alreadySent.has(c.id)).slice(0, limit)

    if (eligible.length === 0) {
      return NextResponse.json({
        sent: 0,
        skipped: candidates.length,
        results: [],
        message: 'All top candidates already have active sessions.',
      })
    }

    const results: { candidate_id: string; name: string; status: string; error?: string }[] = []
    let sent = 0
    let skipped = 0

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    for (const candidate of eligible) {
      try {
        // Create session + token
        const tokenPayload = {
          sessionId: crypto.randomUUID(),
          candidateId: candidate.id,
          jobId: job_id,
          companyId: company.id,
        }
        const token = createChatToken(tokenPayload)

        const { error: insertError } = await supabase.from('chat_sessions').insert({
          id: tokenPayload.sessionId,
          company_id: company.id,
          candidate_id: candidate.id,
          job_id,
          token,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
          email_to: candidate.email ?? null,
        })

        if (insertError) {
          results.push({ candidate_id: candidate.id, name: candidate.full_name, status: 'error', error: insertError.message })
          skipped++
          continue
        }

        const chatUrl = `${APP_URL}/chat/${token}`

        // Send email if candidate has one
        if (candidate.email) {
          const { error: emailError } = await resend.emails.send({
            from: 'Quorbit Pulse <noreply@thequorbit.com>',
            to: candidate.email,
            subject: `You've been invited to a quick AI readiness chat for ${job.title}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
                <h2 style="font-size:20px;font-weight:700;margin-bottom:12px">Hi ${candidate.full_name.split(' ')[0]},</h2>
                <p style="color:#374151;line-height:1.6;margin-bottom:20px">
                  You've been shortlisted for the <strong>${job.title}</strong> role.
                  We'd like to learn a bit more about you through a short AI-powered chat — it takes about 5 minutes.
                </p>
                <a href="${chatUrl}"
                  style="display:inline-block;padding:12px 28px;background:#7C3AED;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
                  Start the chat →
                </a>
                <p style="color:#9CA3AF;font-size:12px;margin-top:28px">
                  This link expires in 7 days. If you have questions, reply to this email.
                </p>
              </div>
            `,
          })

          if (!emailError) {
            await supabase.from('chat_sessions').update({ email_sent_at: new Date().toISOString() }).eq('id', tokenPayload.sessionId)
          }

          results.push({
            candidate_id: candidate.id,
            name: candidate.full_name,
            status: emailError ? 'session_created_no_email' : 'sent',
            error: emailError ? String(emailError) : undefined,
          })
        } else {
          results.push({ candidate_id: candidate.id, name: candidate.full_name, status: 'no_email' })
        }

        sent++
      } catch (err) {
        results.push({ candidate_id: candidate.id, name: candidate.full_name, status: 'error', error: String(err) })
        skipped++
      }
    }

    return NextResponse.json({
      sent,
      skipped: candidates.length - eligible.length + skipped,
      results,
      job_title: job.title,
    })
  } catch (err) {
    console.error('send-chat-batch error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
