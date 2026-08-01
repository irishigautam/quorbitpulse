/**
 * POST /api/candidates/[id]/request-llm-consent
 *
 * Gate 1 — AI sync consent UX.
 *
 * Employer-triggered. Mints an HMAC-signed consent token, stores it on the
 * candidate row (status='pending'), and emails the candidate a link where
 * they can approve or deny the company analysing their LLM chat export.
 * The upload-llm-export endpoint refuses to run until the candidate has
 * approved via that link — this route only ever *requests* consent, it
 * never grants it.
 *
 * Body: none (candidate id comes from the route param)
 * Returns: { requested: true, email_sent, expires_at } or { error }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'
import { createConsentToken } from '@/lib/consent/token'
import { LIMITS } from '@/lib/security/rate-limit'
import { REPLY_TO_EMAIL } from '@/lib/resend'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY || 'RESEND_NOT_SET')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pulse.thequorbit.com'
const FROM_EMAIL = process.env.RESEND_FROM || 'noreply@thequorbit.com'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { company } = await requireCompany()
    const { id: candidateId } = await params

    const rl = LIMITS.requestConsent(company.id)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Consent-request rate limit reached. Max 10 per hour.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
      )
    }

    const supabase = createServiceClient()

    // Verify candidate belongs to this company
    const { data: candidate, error: candidateErr } = await supabase
      .from('imported_candidates')
      .select('id, full_name, email, llm_consent_status')
      .eq('id', candidateId)
      .eq('company_id', company.id)
      .single()

    if (candidateErr || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (!candidate.email) {
      return NextResponse.json(
        { error: 'This candidate has no email on file. Add one before requesting consent.' },
        { status: 400 },
      )
    }

    if (candidate.llm_consent_status === 'approved') {
      return NextResponse.json(
        { error: 'Candidate has already approved this analysis.' },
        { status: 409 },
      )
    }

    // Mint token — a fresh request invalidates any prior unresponded one,
    // since the old token is overwritten on the row.
    const token = createConsentToken({ candidateId, companyId: company.id })
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const consentUrl = `${APP_URL}/consent/llm-export/${encodeURIComponent(token)}`

    const { error: updateErr } = await supabase
      .from('imported_candidates')
      .update({
        llm_consent_status: 'pending',
        llm_consent_token: token,
        llm_consent_requested_at: new Date().toISOString(),
        llm_consent_responded_at: null,
        llm_consent_expires_at: expiresAt.toISOString(),
      })
      .eq('id', candidateId)
      .eq('company_id', company.id)

    if (updateErr) {
      console.error('request-llm-consent update error:', updateErr)
      return NextResponse.json({ error: 'Failed to create consent request' }, { status: 500 })
    }

    let emailSent = false
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to: candidate.email,
        subject: `${company.name} would like your permission for something`,
        html: buildEmailHtml({
          candidateName: candidate.full_name,
          companyName: company.name,
          consentUrl,
          expiresAt,
        }),
      })
      emailSent = true
    } catch (emailErr: any) {
      // Don't fail the whole request if email fails — request row is created,
      // employer can retry the send. Log only the message, not the full
      // error object, since Resend errors can echo the destination address.
      console.error('Resend email error (request-llm-consent):', emailErr?.message ?? 'unknown error')
    }

    return NextResponse.json({
      requested: true,
      email_sent: emailSent,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    console.error('request-llm-consent error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// ── Email template ──────────────────────────────────────────────────────────

function buildEmailHtml(opts: {
  candidateName: string
  companyName: string
  consentUrl: string
  expiresAt: Date
}) {
  const { candidateName, companyName, consentUrl, expiresAt } = opts
  const firstName = candidateName.split(' ')[0]
  const expiryStr = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permission request from ${companyName}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f6f3;margin:0;padding:40px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e4e0;">

    <div style="background:#7C3AED;padding:32px 36px;">
      <p style="color:#e9d5ff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">
        ${companyName}
      </p>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">
        Can we take a closer look at your AI chat history?
      </h1>
    </div>

    <div style="padding:32px 36px;">
      <p style="color:#1a1a1a;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Hi ${firstName},
      </p>
      <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 20px;">
        ${companyName} would like permission to analyse a ChatGPT or Claude conversation export
        you'd provide, to better understand your skills and experience as part of your application.
        Only work-relevant content would ever be used — personal conversations are filtered out
        automatically and never stored.
      </p>
      <p style="color:#444;font-size:15px;line-height:1.7;margin:0 0 28px;">
        This is entirely optional. Approving or declining takes one click, and won't affect your
        application either way beyond whether this extra signal is included.
      </p>

      <div style="text-align:center;margin-bottom:28px;">
        <a href="${consentUrl}"
           style="display:inline-block;background:#7C3AED;color:#fff;font-size:15px;font-weight:600;
                  text-decoration:none;padding:14px 36px;border-radius:99px;">
          Review the request &rarr;
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

    <div style="background:#f7f6f3;padding:20px 36px;border-top:1px solid #e5e4e0;">
      <p style="color:#aaa;font-size:12px;margin:0;text-align:center;">
        Quorbit Technologies Pvt Ltd &middot; Powered by Quorbit Pulse
      </p>
    </div>
  </div>
</body>
</html>`
}
