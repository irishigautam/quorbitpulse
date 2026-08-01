/**
 * POST /api/jobs/[id]/retry-distribution — P0-007
 *
 * Gate 5 only added *visibility* into which distribution channels failed;
 * there was no way to actually retry them short of a raw SQL/manual fix.
 * This retries ONLY channels currently in 'error' status for the job,
 * leaving already-successful channels untouched (see
 * lib/distribution/retryFailedChannels for why: re-running everything risks
 * duplicate postings on external boards that don't dedupe on their end).
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { retryFailedChannels } from '@/lib/distribution'
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

  const { report, retried } = await retryFailedChannels(job as Job, company)

  if (retried.length > 0) {
    after(() =>
      logAudit({
        companyId: company.id,
        actorId: userId,
        actorRole: role,
        action: 'job.retry_distribution',
        targetType: 'job',
        targetId: job.id,
        metadata: { retried },
      })
    )
  }

  return NextResponse.json({ success: true, retried, report })
}
