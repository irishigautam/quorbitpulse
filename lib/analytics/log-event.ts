/**
 * Gate 4 — funnel event logging (analytics baseline).
 *
 * Lightweight, best-effort append to `funnel_events`. Never throws — a
 * logging failure must never break the business action it's attached to.
 * Mirrors the fire-and-forget pattern already used for emails/webhooks
 * elsewhere in this codebase (e.g. sendJobPostedEmail(...).catch(console.error)).
 */

import { createServiceClient } from '@/lib/supabase/server'

export type FunnelEventType =
  | 'company_signup'
  | 'candidate_signup'
  | 'job_posted'
  | 'candidates_imported'
  | 'candidate_applied'
  | 'candidates_scored'
  | 'chat_completed'
  | 'pipeline_stage_changed'
  // ID-04 (launch checklist) — invite + apply funnel had no start-of-funnel
  // signal, only completion events, so drop-off between "started" and
  // "completed" was invisible.
  | 'invite_sent'
  | 'apply_started'

export async function logEvent(params: {
  eventType: FunnelEventType
  companyId?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('funnel_events').insert({
      event_type: params.eventType,
      company_id: params.companyId ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    console.error('logEvent failed:', err)
  }
}
