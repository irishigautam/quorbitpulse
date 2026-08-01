-- P0-017 / P0-022 — notification reliability + self-hosted error monitoring.
--
-- notification_log: records every attempted outbound notification (email,
-- webhook) with success/failure, so a failed job-posted email or HRMS
-- webhook is no longer silently swallowed inside Promise.allSettled().
--
-- error_log: self-hosted error monitoring. A real Sentry-style external
-- account isn't something that can be created autonomously, so this gives
-- a minimal but functional baseline: unhandled request errors (via Next's
-- instrumentation.ts onRequestError hook) and explicit logError() calls
-- land here, visible from /admin.

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,           -- 'email' | 'webhook'
  template TEXT NOT NULL,          -- e.g. 'job_posted', 'stage_change', 'hrms_webhook'
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  recipient TEXT,
  status TEXT NOT NULL,            -- 'ok' | 'error'
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_status_created ON notification_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_company ON notification_log(company_id, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at DESC);

ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;
