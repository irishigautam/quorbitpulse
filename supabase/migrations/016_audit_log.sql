-- Migration 016: Audit log (P0-020)
--
-- No compliance/audit trail existed anywhere in the codebase — funnel_events
-- (migration 015) is analytics, usage_events is billing metering, neither
-- captures "who did what, when" for permission/job/candidate/pipeline
-- actions. This is a dedicated, append-only audit trail.

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  actor_id    UUID,          -- auth.users.id of whoever performed the action (null for system/cron)
  actor_role  TEXT,          -- role at time of action (admin/recruiter/viewer/candidate/system)
  action      TEXT NOT NULL, -- e.g. 'job.create', 'job.expire', 'member.invite', 'member.role_change', 'pipeline.stage_change'
  target_type TEXT,          -- e.g. 'job', 'candidate', 'assignment', 'member'
  target_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_created
  ON audit_log(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON audit_log(action, created_at DESC);

-- Written exclusively via the service-role client (lib/audit/log.ts) — no
-- direct client access, so RLS stays default-deny with no policies needed.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
