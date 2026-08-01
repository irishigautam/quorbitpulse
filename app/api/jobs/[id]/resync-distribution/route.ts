/**
 * POST /api/jobs/[id]/resync-distribution
 *
 * retry-distribution only re-runs channels currently in 'error' status — it
 * has no way to fix a job whose sync_status is 'stale' (content edited after
 * the last successful distribution run), since every channel may still show
 * 'ok' for the *old* content. This does a full re-run of every currently
 * configured channel against the job's current content, exactly like a
 * fresh publish would, and advances the distributed-fingerprint baseline to
 * match — the counterpart to lib/distribution/index.ts's resyncJob().
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { resyncJob } from '@/lib/distribution'
import { logAudit } from '@/lib/audit/log'
import type { Job } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { userId, company, role } = await requireRole('recruiter')
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  if (job.status !== 'active') {
    return NextResponse.json({ error: 'Only published jobs can be resynced' }, { status: 400 })
  }

  const report = await resyncJob(job as Job, company)

  after(() =>
    logAudit({
      companyId: company.id,
      actorId: userId,
      actorRole: role,
      action: 'job.resync_distribution',
      targetType: 'job',
      targetId: job.id,
      metadata: { channels: Object.keys(report) },
    })
  )

  return NextResponse.json({ success: true, report })
}
