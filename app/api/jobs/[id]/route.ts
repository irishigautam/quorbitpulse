/**
 * PATCH /api/jobs/[id] — edit an existing job.
 *
 * There was no way to correct a typo or update a job's details after
 * posting short of expiring it and starting over. requireRole('recruiter')
 * matches the same gating already applied to create/expire/retry-distribution.
 * Only fields that make sense to edit post-publish are accepted — status and
 * expires_at are managed separately (expire route / auto-expiry).
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit/log'
import type { PostJobFormValues } from '@/types'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId, company, role } = await requireRole('recruiter')
  const supabase = await createClient()

  const form: Partial<PostJobFormValues> = await req.json()

  if (form.title !== undefined && !form.title.trim()) {
    return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
  }
  if (form.location !== undefined && !form.location.trim()) {
    return NextResponse.json({ error: 'Location is required' }, { status: 400 })
  }
  if (form.description !== undefined) {
    const descText = form.description.replace(/<[^>]*>/g, '').trim()
    if (descText.length < 100) {
      return NextResponse.json({ error: 'Job description must be at least 100 characters' }, { status: 400 })
    }
  }

  // Verify the job belongs to this company before touching it
  const { data: existing, error: fetchErr } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (form.title !== undefined) updates.title = form.title.trim()
  if (form.description !== undefined) updates.description = form.description
  if (form.location !== undefined) updates.location = form.location.trim()
  if (form.job_type !== undefined) updates.job_type = form.job_type
  if (form.remote !== undefined) updates.remote = form.remote
  if (form.skills !== undefined) updates.skills = form.skills
  if (form.domain !== undefined) updates.domain = form.domain
  if (form.min_experience !== undefined) updates.min_experience = form.min_experience
  if (form.salary_min !== undefined) updates.salary_min = form.salary_min ? parseInt(form.salary_min) : null
  if (form.salary_max !== undefined) updates.salary_max = form.salary_max ? parseInt(form.salary_max) : null
  if (form.salary_currency !== undefined) updates.salary_currency = form.salary_currency
  if (form.apply_url !== undefined) updates.apply_url = form.apply_url.trim() ? form.apply_url.trim() : null
  if (form.apply_email !== undefined) updates.apply_email = form.apply_email.trim() ? form.apply_email.trim() : null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error || !job) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update job' }, { status: 500 })
  }

  after(() =>
    logAudit({
      companyId: company.id,
      actorId: userId,
      actorRole: role,
      action: 'job.edit',
      targetType: 'job',
      targetId: job.id,
      metadata: { edited_fields: Object.keys(updates) },
    })
  )

  return NextResponse.json({ success: true, job })
}
