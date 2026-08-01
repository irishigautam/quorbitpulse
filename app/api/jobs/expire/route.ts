import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { pingGoogleIndexing } from '@/lib/google-indexing'
import { logAudit } from '@/lib/audit/log'
import { jobSlug } from '@/types'

export async function POST(req: NextRequest) {
  // P0-018: same membership bug as jobs/create — `companies.user_id = auth.uid()`
  // only matched the original owner, so invited team members couldn't expire a
  // job either. requireRole() fixes membership scoping and gates by role
  // (viewers read-only).
  const { userId, companyId, role } = await requireRole('recruiter')
  const supabase = createServiceClient()

  const { job_id } = await req.json()
  if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 })

  const { data: job, error } = await supabase
    .from('jobs')
    .update({ status: 'expired' })
    .eq('id', job_id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error || !job) return NextResponse.json({ error: 'Failed to expire job' }, { status: 500 })

  // Notify Google to remove from index + audit log (non-blocking, but guaranteed
  // to finish — see jobs/create/route.ts for why after() is needed here)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'

  after(async () => {
    await Promise.allSettled([
      pingGoogleIndexing(`${appUrl}/jobs/${jobSlug(job)}`, 'URL_DELETED'),
      logAudit({
        companyId,
        actorId: userId,
        actorRole: role,
        action: 'job.expire',
        targetType: 'job',
        targetId: job.id,
        metadata: { title: job.title },
      }),
    ])
  })

  return NextResponse.json({ success: true })
}
