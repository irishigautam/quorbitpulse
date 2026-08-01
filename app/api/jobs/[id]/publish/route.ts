/**
 * POST /api/jobs/[id]/publish
 *
 * Publishes a draft job — the other half of Save Draft. A draft can be
 * created with just a title (see /api/jobs/create's isDraft branch), so this
 * route enforces the same full-field validation /api/jobs/create applies to
 * a direct publish, checks quota/plan (skipped entirely for drafts at
 * creation time), and fires the same post-publish side effects (Google
 * indexing, job-posted email, multi-channel distribution, audit log) that a
 * direct "Publish job" already gets.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { pingGoogleIndexing } from '@/lib/google-indexing'
import { sendJobPostedEmail } from '@/lib/emails'
import { distributeJob } from '@/lib/distribution'
import { logEvent } from '@/lib/analytics/log-event'
import { logAudit } from '@/lib/audit/log'
import { notifyAttempt } from '@/lib/notifications/log'
import { jobSlug } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { userId, company, role } = await requireRole('recruiter')
  const supabase = await createClient()

  if (!company.plan_active) return NextResponse.json({ error: 'Plan not active' }, { status: 403 })
  if (company.jobs_used >= company.jobs_quota) {
    return NextResponse.json({ error: 'Job quota exceeded' }, { status: 403 })
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Job is not a draft' }, { status: 400 })
  }

  // Enforce the same required fields a direct publish would have — a draft
  // can otherwise be missing location/description entirely.
  if (!existing.title?.trim()) {
    return NextResponse.json({ error: 'Add a job title before publishing' }, { status: 400 })
  }
  if (!existing.location?.trim()) {
    return NextResponse.json({ error: 'Add a location before publishing' }, { status: 400 })
  }
  const descText = (existing.description ?? '').replace(/<[^>]*>/g, '').trim()
  if (descText.length < 100) {
    return NextResponse.json({ error: 'Job description must be at least 100 characters before publishing' }, { status: 400 })
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 60)

  const { data: job, error } = await supabase
    .from('jobs')
    .update({
      status: 'active',
      posted_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', id)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Failed to publish job' }, { status: 500 })
  }

  await supabase
    .from('companies')
    .update({ jobs_used: company.jobs_used + 1 })
    .eq('id', company.id)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'
  const slug = jobSlug(job)

  after(async () => {
    await Promise.allSettled([
      pingGoogleIndexing(`${appUrl}/jobs/${slug}`),
      notifyAttempt({
        channel: 'email',
        template: 'job_posted',
        companyId: company.id,
        recipient: company.careers_email,
        metadata: { jobId: job.id },
        send: () => sendJobPostedEmail(company, job),
      }),
      distributeJob(job, company),
      logEvent({ eventType: 'job_posted', companyId: company.id, entityId: job.id }),
      logAudit({
        companyId: company.id,
        actorId: userId,
        actorRole: role,
        action: 'job.edit',
        targetType: 'job',
        targetId: job.id,
        metadata: { title: job.title, action_detail: 'draft_published' },
      }),
    ])
  })

  return NextResponse.json({ success: true, job })
}
