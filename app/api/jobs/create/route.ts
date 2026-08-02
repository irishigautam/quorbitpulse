import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { pingGoogleIndexing } from '@/lib/google-indexing'
import { sendJobPostedEmail } from '@/lib/emails'
import { distributeJob } from '@/lib/distribution'
import { computeJobFingerprint } from '@/lib/distribution/fingerprint'
import { logEvent } from '@/lib/analytics/log-event'
import { logAudit } from '@/lib/audit/log'
import { notifyAttempt } from '@/lib/notifications/log'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { jobSlug } from '@/types'
import type { PostJobFormValues } from '@/types'

export async function POST(req: NextRequest) {
  // P0-018: previously looked up the company via `companies.user_id = auth.uid()`
  // directly, which only ever matched the original signup owner — any invited
  // team member (company_members row) got a 404 "Company not found" trying to
  // post a job at all. requireRole() is membership-aware (works for any
  // accepted company_members row) and now also gates by role: viewers are
  // read-only and cannot post jobs.
  const { userId, company, role } = await requireRole('recruiter')
  const supabase = await createClient()

  const form: PostJobFormValues & { status?: 'active' | 'draft'; idempotency_key?: string } = await req.json()
  const isDraft = form.status === 'draft'

  // Retry-safety: if the client sent an idempotency key and a job with that
  // (company_id, idempotency_key) pair already exists, this is a retry of a
  // request that already succeeded (lost response, network-level retry) -
  // return the existing job instead of creating a duplicate.
  if (form.idempotency_key) {
    const { data: existingJob } = await supabase
      .from('jobs')
      .select()
      .eq('company_id', company.id)
      .eq('idempotency_key', form.idempotency_key)
      .maybeSingle()
    if (existingJob) {
      return NextResponse.json({ success: true, job: existingJob })
    }
  }

  // Drafts don't count against the posting quota or require an active plan —
  // both only matter once the job actually goes live. They're re-checked for
  // real at /api/jobs/[id]/publish when a draft is published.
  if (!isDraft) {
    if (!company.plan_active) return NextResponse.json({ error: 'Plan not active' }, { status: 403 })
    // Fast-path rejection only, using requireRole()'s possibly-stale read of
    // company.jobs_used - actual enforcement is the atomic RPC below.
    if (company.jobs_used >= company.jobs_quota) {
      return NextResponse.json({ error: 'Job quota exceeded' }, { status: 403 })
    }
  }

  if (!form.title?.trim()) {
    return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
  }
  // Drafts are deliberately allowed to be incomplete — only publishing
  // (here or via /api/jobs/[id]/publish) enforces the full field set.
  if (!isDraft) {
    if (!form.location?.trim()) return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    const descText = (form.description ?? '').replace(/<[^>]*>/g, '').trim()
    if (descText.length < 100) {
      return NextResponse.json({ error: 'Job description must be at least 100 characters' }, { status: 400 })
    }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 60)

  // Fingerprint Job: computed up front from the same content fields being
  // inserted, so the row is born with a fingerprint instead of needing a
  // separate backfill pass. For drafts this just establishes the baseline —
  // sync_status stays 'not_distributed' until publish actually runs
  // distribution against it.
  const fingerprint = computeJobFingerprint({
    title: form.title.trim(),
    description: form.description ?? '',
    requirements: form.requirements?.trim() ? form.requirements : null,
    location: form.location?.trim() ?? '',
    job_type: form.job_type,
    remote: form.remote,
    skills: form.skills ?? [],
    domain: form.domain ?? [],
    min_experience: form.min_experience ?? 0,
    salary_min: form.salary_min ? parseInt(form.salary_min) : null,
    salary_max: form.salary_max ? parseInt(form.salary_max) : null,
    salary_currency: form.salary_currency,
    apply_url: form.apply_url?.trim() ? form.apply_url.trim() : null,
    apply_email: form.apply_email?.trim() ? form.apply_email.trim() : null,
  })

  // Reserve quota atomically before inserting the job (non-draft only) -
  // reusing the same try_increment_job_quota RPC that /api/jobs/[id]/publish
  // uses, instead of the previous separate, non-atomic
  // `jobs_used: company.jobs_used + 1` read-then-write this route used to
  // have (two independently-written copies of the same race). If the
  // insert below fails after this succeeds, the reservation is released.
  const serviceClient = createServiceClient()
  if (!isDraft) {
    const { data: quotaOk } = await serviceClient.rpc('try_increment_job_quota', { p_company_id: company.id })
    if (!quotaOk) {
      return NextResponse.json({ error: 'Job quota exceeded' }, { status: 403 })
    }
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      company_id: company.id,
      title: form.title.trim(),
      description: form.description ?? '',
      requirements: form.requirements?.trim() ? form.requirements : null,
      location: form.location?.trim() ?? '',
      job_type: form.job_type,
      remote: form.remote,
      skills: form.skills ?? [],
      domain: form.domain ?? [],
      min_experience: form.min_experience ?? 0,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      salary_currency: form.salary_currency,
      // Optional supplementary channels only — candidates always apply
      // on-platform via /api/candidate/apply regardless of these.
      apply_url: form.apply_url?.trim() ? form.apply_url.trim() : null,
      apply_email: form.apply_email?.trim() ? form.apply_email.trim() : null,
      status: isDraft ? 'draft' : 'active',
      expires_at: expiresAt.toISOString(),
      fingerprint,
      idempotency_key: form.idempotency_key ?? null,
    })
    .select()
    .single()

  if (error || !job) {
    console.error('[jobs/create]', error)
    if (!isDraft) {
      // Release the quota we reserved above - a failed insert should not
      // permanently burn one unit of the company's quota.
      await serviceClient.rpc('decrement_job_quota', { p_company_id: company.id })
    }
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  if (isDraft) {
    // No quota, no distribution, no indexing, no notification email — none of
    // that applies until the draft is actually published. Just log the audit
    // trail entry so "who created this draft" is still traceable.
    after(() =>
      logAudit({
        companyId: company.id,
        actorId: userId,
        actorRole: role,
        action: 'job.create',
        targetType: 'job',
        targetId: job.id,
        metadata: { title: job.title, status: 'draft' },
      })
    )
    return NextResponse.json({ success: true, job })
  }

  // Post-response side effects (Google indexing, email, multi-channel distribution,
  // funnel logging). These were previously called without awaiting and without
  // `after()` — on Vercel, once the response is sent the function can be frozen
  // at any point, so an un-awaited async call has no guarantee of ever finishing.
  // Confirmed in prod (Gate 6 smoke test): distribution_channels was left as `{}`
  // on every job post because distributeJob() was getting cut off. `after()` keeps
  // the function alive to actually finish this work without delaying the response.
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
        action: 'job.create',
        targetType: 'job',
        targetId: job.id,
        metadata: { title: job.title },
      }),
    ])
  })

  return NextResponse.json({ success: true, job })
}
