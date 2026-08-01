-- Migration 015: Funnel events (Gate 4 — P0 launch, analytics baseline)
--
-- Existing usage_events (lib/subscription.ts) is a billing-metering counter
-- only (import/chat/score, consumed by checkLimit/recordUsage) — it does not
-- track chat/score in practice (recordUsage is only ever called with
-- 'import') and has no funnel/sequencing shape. This adds a separate,
-- append-only funnel_events log so the founder can see signup -> post ->
-- import -> score -> chat -> pipeline-stage conversion during launch week,
-- independent of billing semantics.

CREATE TABLE IF NOT EXISTS funnel_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  -- company_signup | candidate_signup | job_posted | candidates_imported |
  -- candidate_applied | candidates_scored | chat_completed | pipeline_stage_changed
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  entity_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_type_created
  ON funnel_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_events_company
  ON funnel_events(company_id) WHERE company_id IS NOT NULL;

-- Written exclusively via the service-role client (lib/analytics/log-event.ts,
-- app/api/events/track/route.ts) — no direct client access, so RLS stays
-- default-deny with no policies needed.
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
