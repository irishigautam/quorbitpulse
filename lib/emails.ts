import { resend, FROM_EMAIL, APP_URL } from '@/lib/resend'
import type { Company, Job } from '@/types'
import { jobSlug } from '@/types'

// ── Welcome email ──────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(company: Company) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: company.careers_email ?? '',
    subject: 'Welcome to JobPulse — your account is active',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #0A0F1E;">
  <h1 style="font-size: 24px; margin-bottom: 4px;">Welcome to JobPulse, ${company.name} 👋</h1>
  <p style="color: #6B7280; margin-top: 0;">Your plan is now active.</p>

  <div style="background: #EFF6FF; border-radius: 12px; padding: 20px; margin: 24px 0;">
    <strong>Your plan at a glance:</strong>
    <ul style="margin: 12px 0; padding-left: 20px; color: #1F2937;">
      <li>${company.jobs_quota} job postings included</li>
      <li>Each posting is live for 60 days</li>
      <li>Auto-indexed on Google Jobs</li>
      <li>Appears in AI job search tools (Claude, ChatGPT)</li>
      <li>Free public API + MCP server + RSS feed</li>
    </ul>
  </div>

  <a href="${APP_URL}/dashboard/post" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
    Post your first job →
  </a>

  <p style="font-size: 13px; color: #6B7280;">
    Your dashboard: <a href="${APP_URL}/dashboard" style="color: #2563EB;">${APP_URL}/dashboard</a>
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="font-size: 12px; color: #9CA3AF;">Powered by <a href="https://quorbit.com" style="color: #6B7280;">Quorbit</a></p>
</body>
</html>`,
  })
}

// ── Job posted email ───────────────────────────────────────────────────────────

export async function sendJobPostedEmail(company: Company, job: Job) {
  const slug = jobSlug(job)
  const jobUrl = `${APP_URL}/jobs/${slug}`
  const expires = new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  await resend.emails.send({
    from: FROM_EMAIL,
    to: company.careers_email ?? '',
    subject: `Your job is live: ${job.title}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #0A0F1E;">
  <h1 style="font-size: 22px; margin-bottom: 4px;">✅ Your job is live!</h1>
  <p style="color: #6B7280; margin-top: 0; margin-bottom: 24px;">"${job.title}" is now live on JobPulse.</p>

  <a href="${jobUrl}" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
    View live listing →
  </a>

  <div style="background: #F9FAFB; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 14px;">
    <p style="margin: 0 0 8px;"><strong>What happens next:</strong></p>
    <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.7;">
      <li>Google will index this job (usually within 24–48 hours)</li>
      <li>It's available via our free API and MCP server</li>
      <li>Listed in our RSS feed for job boards and aggregators</li>
    </ul>
  </div>

  <p style="font-size: 13px; color: #6B7280;">
    This listing expires on <strong>${expires}</strong>. You can manage your listings at <a href="${APP_URL}/dashboard/jobs" style="color: #2563EB;">${APP_URL}/dashboard/jobs</a>.
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="font-size: 12px; color: #9CA3AF;">Powered by <a href="https://quorbit.com" style="color: #6B7280;">Quorbit</a></p>
</body>
</html>`,
  })
}

// ── Expiry reminder email ──────────────────────────────────────────────────────

export async function sendExpiryReminderEmail(company: Company, job: Job) {
  const expires = new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  await resend.emails.send({
    from: FROM_EMAIL,
    to: company.careers_email ?? '',
    subject: `Your job posting expires in 7 days: ${job.title}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #0A0F1E;">
  <h1 style="font-size: 22px; margin-bottom: 4px;">⏰ Listing expiring soon</h1>
  <p style="color: #6B7280; margin-top: 0; margin-bottom: 24px;">"${job.title}" expires on ${expires}.</p>

  <p>If this role is still open, log in to your dashboard to expire and re-post the listing.</p>

  <a href="${APP_URL}/dashboard/jobs" style="display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-bottom: 24px;">
    Manage listings →
  </a>

  <p style="font-size: 13px; color: #6B7280;">
    If the position is filled, no action needed — the listing will auto-expire on ${expires}.
  </p>

  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
  <p style="font-size: 12px; color: #9CA3AF;">Powered by <a href="https://quorbit.com" style="color: #6B7280;">Quorbit</a></p>
</body>
</html>`,
  })
}
