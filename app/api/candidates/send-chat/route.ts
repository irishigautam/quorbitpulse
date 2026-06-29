/**
 * POST /api/candidates/send-chat
 *
 * Sends an AI chat invite to a candidate for a specific job.
 * Creates a chat_session row, mints an HMAC-signed token, and
 * sends an email via Resend with the candidate-facing chat link.
 *
 * Body: { candidate_id: string, job_id: string }
 *
 * Returns: { session_id, token, chat_url, email_sent }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'
import { createChatToken } from '@/lib/chat/token'
import { LIMITS } from '@/lib/security/rate-limit'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY || 'RESEND_NOT_SET')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pulse.thequorbit.com'
const FROM_EMAIL = process.env.RESEND_FROM || 'noreply@thequorbit.com'

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()

    // Rate limit: 5 send-chat emails / hour / company (tight — each triggers email + Resend cost)
    const rl = LIMITS.sendChat(company.id)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Send-chat rate limit reached. Max 5 per hour.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
      )
    }

    const body = await req.json()
    const { candidate_id, job_id } = body

    if (!candidate_id || !job_id) {
      return NextResponse.json(
        { error: 'candidate_id and job_id are required' },
        { status: 400 },
      )
    }

    const supabase = createServiceClient()

    // 1. Verify candidate belongs to this company
    const { data: candidate, error: candidateErr } = await supabase
      .from('imported_candidates')
      .select('id, full_name, email')
      .eq('id', candidate_id)
      .eq('company_id', company.id)
      .single()

    if (candidateErr || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // 2. Verify job belongs to this company
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('id', job_id)
      .eq('company_id', company.id)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 3. Check for an existing active/pending session for this candidate+job
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id, status, expires_at')
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .eq('company_id', company.id)
      .in('status', ['pending', 'active'])
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'An active chat session already exists for this candidate and job', session_id: existing.id },
        { status: 409 },
      )
    }

    // 4. Generate session ID first (we need it for the token)
    const sessionId = crypto.randomUUID()

    // 5. Mint the HMAC token
    const token = createChatToken({
      sessionId,
      candidateId: candidate_id,
      jobId: job_id,
      companyId: company.id,
    })

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const chatUrl = `${APP_URL}/chat/${encodeURIComponent(token)}`

    // 6. Create the session row
    const { error: insertErr } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        company_id: company.id,
        candidate_id,
        job_id,
        token,
        expires_at: expiresAt.toISOString(),
        email_to: candidate.email || null,
        status: 'pending',
      })

    if (insertErr) {
      console.error('chat_sessions insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
    }

    // 7. Send email if candidate has an email address
    let emailSent = false
    if (candidate.email) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: candidate.email,
          subject: `Quick chat about the ${job.title} role`,
          html: buildEmailHtml({
            candidateName: candidate.full_name,
            jobTitle: job.title,
            companyName: company.name,
            chatUrl,
            expiresAt,
          }),
        })

        await supabase
          .from('chat_sessions')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', sessionId)

        emailSent = true
      } catch (emailErr) {
        // Don't fail the whole request if email fails — session is created
        console.error('Resend email error:', emailErr)
      }
    }

    return NextResponse.json({
      session_id: sessionId,
      token,
      chat_url: chatUrl,
      email_sent: emailSent,
      expires_at: expiresAt.toISOString(),
      candidate_has_email: !!candidate.email,
    })
  } catch (err) {
    console.error('send-chat error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// ── Email template ──────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  candidateName: string
  jobTitle: string
  companyName: string
  chatUrl: string
  expiresAt: Date
}) {
  const { candidateName, jobTitle, companyName, chatUrl, expiresAt } = opts
  const firstName = candidateName.split(' ')[0]
  const expiryStr = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat invitation from ${companyName}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f6f3;margin:0;padding:40px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e4e0;">

    <!-- Header -->
    <div style="background:#7C3AED;padding:32px 36px;">
      <p style="color:#e9d5ff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">
        ${companyName}
      </p>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">
        We'd love to learn more about you
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">
      <p style="color:#1a1a1a;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi ${firstName},
      </p>
      <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Thanks for your interest in the <strong>${jobTitle}</strong> role at ${companyName}.
        We'd like to get a better sense of your background through a short AI-powered conversation —
        it takes about 5 minutes and you can do it from any device.
      </p>
      <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Just tap the button below to get started. No account or login required.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${chatUrl}"
           style="display:inline-block;background:#7C3AED;color:#fff;font-size:15px;font-weight:600;
                  text-decoration:none;padding:14px 36px;border-radius:99px;">
          Start the conversation &rarr;
        </a>
      </div>

      <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 8px;">
        This link is private — please don't share it. It expires on ${expiryStr}.
      </p>
      <p style="color:#aaa;font-size:12px;line-height:1.6;margin:0;">
        If you weren't expecting this email, you can ignore it. If you have questions,
        reply to this email or contact us at <a href="mailto:support@thequorbit.com" style="color:#7C3AED;">support@thequorbit.com</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f7f6f3;padding:20px 36px;border-top:1px solid #e5e4e0;">
      <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
        Quorbit Technologies Pvt Ltd &middot; Powered by Quorbit Pulse
      </p>
    </div>
  </div>
</body>
</html>`
}
