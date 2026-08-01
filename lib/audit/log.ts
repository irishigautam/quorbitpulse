/**
 * P0-020 — audit logging.
 *
 * Distinct from lib/analytics/log-event.ts (product/funnel analytics) and
 * usage_events (billing metering). This exists for compliance/traceability:
 * "who did what, to what, when." Fire-and-forget-safe (never throws) but
 * intended to be awaited at call sites that are also touched by after() —
 * follow the same pattern as logEvent().
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { MemberRole } from '@/lib/auth'

export type AuditAction =
  | 'job.create'
  | 'job.expire'
  | 'job.edit'
  | 'job.retry_distribution'
  | 'member.invite'
  | 'member.invite_revoke'
  | 'member.role_change'
  | 'member.remove'
  | 'candidate.import'
  | 'pipeline.stage_change'
  | 'company.profile_update'
  | 'billing.plan_change'

export async function logAudit(params: {
  companyId: string | null
  actorId?: string | null
  actorRole?: MemberRole | 'system' | null
  action: AuditAction
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_log').insert({
      company_id: params.companyId,
      actor_id: params.actorId ?? null,
      actor_role: params.actorRole ?? null,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    console.error('logAudit failed:', err)
  }
}
