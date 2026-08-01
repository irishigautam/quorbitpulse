/**
 * ats6 — Stage-change email notifications via Resend
 * Sends candidate a notification when they move between pipeline stages.
 */

import { Resend } from 'resend'
import { REPLY_TO_EMAIL } from '@/lib/resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const STAGE_LABELS: Record<string, string> = {
  sourced:   'Sourced',
  screened:  'Screened',
  interview: 'Interview',
  offer:     'Offer Extended',
  hired:     'Hired',
  rejected:  'Application Closed',
}

const STAGE_MESSAGES: Record<string, string> = {
  screened:  'Great news — your profile has been reviewed and you\'ve moved to the next stage.',
  interview: 'We\'d love to connect! You\'ve been shortlisted for an interview.',
  offer:     'Exciting update — we\'re extending an offer for this role.',
  hired:     'Congratulations! We\'re delighted to welcome you to the team.',
  rejected:  'Thank you for your interest. After careful consideration, we\'ve decided to move forward with other candidates at this time.',
}

export async function sendStageChangeEmail({
  candidateName,
  candidateEmail,
  jobTitle,
  previousStage,
  newStage,
  companyName,
}: {
  candidateName: string
  candidateEmail: string
  jobTitle: string
  previousStage: string
  newStage: string
  companyName: string
}) {
  if (!process.env.RESEND_API_KEY) return
  if (!process.env.RESEND_FROM_EMAIL) return

  // Don't email for sourced → sourced or internal transitions with no message
  const message = STAGE_MESSAGES[newStage]
  if (!message) return

  const stageLabel = STAGE_LABELS[newStage] ?? newStage

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: candidateEmail,
    subject: `Update on your application — ${jobTitle} at ${companyName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
  <p style="color: #6B7280; font-size: 13px; margin-bottom: 32px;">${companyName}</p>

  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">Application update: ${stageLabel}</h2>
  <p style="color: #374151; margin-bottom: 24px; line-height: 1.6;">Hi ${candidateName},</p>
  <p style="color: #374151; margin-bottom: 24px; line-height: 1.6;">${message}</p>
  <p style="color: #374151; line-height: 1.6;">
    <strong>Role:</strong> ${jobTitle}<br>
    <strong>Stage:</strong> ${stageLabel}
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    You're receiving this because you applied to ${jobTitle} at ${companyName}. Powered by Quorbit.
  </p>
</body>
</html>`,
  })
}

/**
 * CJ-05 / CJ-07 (launch checklist) — a candidate submitting an application
 * previously got only the in-page confirmation JSON with no email receipt.
 * The stage-change email above never fires for the initial 'sourced' stage
 * (STAGE_MESSAGES has no entry for it), so this is a separate, dedicated
 * "we got it" email sent once at apply time.
 */
export async function sendApplicationReceivedEmail({
  candidateName,
  candidateEmail,
  jobTitle,
  companyName,
}: {
  candidateName: string
  candidateEmail: string
  jobTitle: string
  companyName: string
}) {
  if (!process.env.RESEND_API_KEY) return
  if (!process.env.RESEND_FROM_EMAIL) return

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: candidateEmail,
    subject: `Application received — ${jobTitle} at ${companyName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
  <p style="color: #6B7280; font-size: 13px; margin-bottom: 32px;">${companyName}</p>
  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">✅ We've received your application</h2>
  <p style="color: #374151; margin-bottom: 24px; line-height: 1.6;">Hi ${candidateName},</p>
  <p style="color: #374151; margin-bottom: 24px; line-height: 1.6;">
    Thanks for applying to <strong>${jobTitle}</strong> at ${companyName}. Your application and profile have been sent to the hiring team — we'll let you know here by email if your status changes.
  </p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">
    You're receiving this because you applied to ${jobTitle} at ${companyName}. Powered by Quorbit.
  </p>
</body>
</html>`,
  })
}

/**
 * EJ-06 (launch checklist) — an employer previously received zero signal
 * when a candidate applied to their job; the only way to notice was to open
 * the dashboard. Fires once per application to the company's careers_email.
 */
export async function sendNewApplicationEmail({
  careersEmail,
  candidateName,
  jobTitle,
  matchScore,
  dashboardUrl,
}: {
  careersEmail: string
  candidateName: string
  jobTitle: string
  matchScore: number
  dashboardUrl: string
}) {
  if (!process.env.RESEND_API_KEY) return
  if (!process.env.RESEND_FROM_EMAIL) return
  if (!careersEmail) return

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: careersEmail,
    subject: `New applicant for ${jobTitle}: ${candidateName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
  <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 8px;">New applicant: ${candidateName}</h2>
  <p style="color: #374151; margin-bottom: 16px; line-height: 1.6;">
    ${candidateName} just applied to <strong>${jobTitle}</strong> — match score ${matchScore}/100.
  </p>
  <a href="${dashboardUrl}" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 8px 0 24px;">
    Review candidate →
  </a>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;">
  <p style="color: #9CA3AF; font-size: 12px;">Powered by Quorbit.</p>
</body>
</html>`,
  })
}
