/**
 * PATCH /api/assignments/[id]/stage
 * Move a candidate's pipeline stage for a job assignment.
 * Also triggers ats6 (stage-change email) and ats7 (HRMS webhook) if configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendStageChangeEmail } from '@/lib/ats/notifications'
import { fireHrmsWebhook } from '@/lib/ats/hrms-webhook'

export const dynamic = 'force-dynamic'

const VALID_STAGES = ['sourced', 'screened', 'interview', 'offer', 'hired', 'rejected'] as const
type Stage = typeof VALID_STAGES[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()
    const body = await req.json()
    const stage = body.stage as Stage

    if (!VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 })
    }

    // Verify assignment belongs to company
    const { data: assignment, error: fetchErr } = await supabase
      .from('candidate_job_assignments')
      .select(`
        id, pipeline_stage,
        candidate:imported_candidates(id, full_name, email),
        job:jobs(id, title)
      `)
      .eq('id', params.id)
      .eq('company_id', company.id)
      .single()

    if (fetchErr || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const previousStage = assignment.pipeline_stage

    const { error: updateErr } = await supabase
      .from('candidate_job_assignments')
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('company_id', company.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Also update candidate status if moved to hired/rejected
    if (stage === 'hired' || stage === 'rejected') {
      await supabase
        .from('imported_candidates')
        .update({ status: stage })
        .eq('id', (assignment.candidate as any).id)
        .eq('company_id', company.id)
    }

    // ats6 — stage change email (fire-and-forget)
    const candidate = assignment.candidate as any
    const job = assignment.job as any
    if (candidate?.email && stage !== previousStage) {
      sendStageChangeEmail({
        candidateName: candidate.full_name,
        candidateEmail: candidate.email,
        jobTitle: job?.title ?? 'the role',
        previousStage,
        newStage: stage,
        companyName: company.name,
      }).catch(console.error)
    }

    // ats7 — HRMS webhook (fire-and-forget)
    if (stage === 'hired' || stage === 'rejected') {
      fireHrmsWebhook({
        companyId: company.id,
        event: stage === 'hired' ? 'candidate.hired' : 'candidate.rejected',
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        jobId: job?.id,
        jobTitle: job?.title,
        stage,
      }).catch(console.error)
    }

    return NextResponse.json({ id: params.id, stage, previousStage })
  } catch (err) {
    console.error('stage update error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
