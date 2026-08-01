/**
 * PATCH /api/assignments/[id]/stage
 * Move a candidate's pipeline stage for a job assignment.
 * Also triggers ats6 (stage-change email) and ats7 (HRMS webhook) if configured.
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendStageChangeEmail } from '@/lib/ats/notifications'
import { fireHrmsWebhook } from '@/lib/ats/hrms-webhook'
import { logEvent } from '@/lib/analytics/log-event'
import { logAudit } from '@/lib/audit/log'
import { notifyAttempt } from '@/lib/notifications/log'

export const dynamic = 'force-dynamic'

const VALID_STAGES = ['sourced', 'screened', 'interview', 'offer', 'hired', 'rejected'] as const
type Stage = typeof VALID_STAGES[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assignmentId } = await params
    // P0-018: pipeline stage moves are a material action — require recruiter+
    const { userId, role, company } = await requireRole('recruiter')
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
      .eq('id', assignmentId)
      .eq('company_id', company.id)
      .single()

    if (fetchErr || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    const previousStage = assignment.pipeline_stage

    const { error: updateErr } = await supabase
      .from('candidate_job_assignments')
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
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

    // Post-response side effects. Previously fired without awaiting and without
    // `after()` — same class of bug as jobs/create/route.ts (Gate 6): once the
    // response is sent, Vercel can freeze the function before an un-awaited
    // promise finishes, so the funnel event / stage-change email / HRMS webhook
    // had no real guarantee of completing. `after()` keeps the function alive
    // to finish this work without delaying the response.
    const candidate = assignment.candidate as any
    const job = assignment.job as any

    after(async () => {
      const tasks: Promise<unknown>[] = []

      if (stage !== previousStage) {
        tasks.push(logEvent({
          eventType: 'pipeline_stage_changed',
          companyId: company.id,
          entityId: assignmentId,
          metadata: { stage, previous_stage: previousStage },
        }))
        tasks.push(logAudit({
          companyId: company.id,
          actorId: userId,
          actorRole: role,
          action: 'pipeline.stage_change',
          targetType: 'assignment',
          targetId: assignmentId,
          metadata: { stage, previous_stage: previousStage },
        }))
      }

      if (candidate?.email && stage !== previousStage) {
        tasks.push(notifyAttempt({
          channel: 'email',
          template: 'stage_change',
          companyId: company.id,
          recipient: candidate.email,
          metadata: { assignmentId, stage, previousStage },
          send: () => sendStageChangeEmail({
            candidateName: candidate.full_name,
            candidateEmail: candidate.email,
            jobTitle: job?.title ?? 'the role',
            previousStage,
            newStage: stage,
            companyName: company.name,
          }),
        }))
      }

      if (stage === 'hired' || stage === 'rejected') {
        tasks.push(notifyAttempt({
          channel: 'webhook',
          template: 'hrms_webhook',
          companyId: company.id,
          recipient: null,
          metadata: { assignmentId, stage, candidateId: candidate.id },
          send: () => fireHrmsWebhook({
            companyId: company.id,
            event: stage === 'hired' ? 'candidate.hired' : 'candidate.rejected',
            candidateId: candidate.id,
            candidateName: candidate.full_name,
            jobId: job?.id,
            jobTitle: job?.title,
            stage,
          }),
        }))
      }

      await Promise.allSettled(tasks)
    })

    return NextResponse.json({ id: assignmentId, stage, previousStage })
  } catch (err) {
    console.error('stage update error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
