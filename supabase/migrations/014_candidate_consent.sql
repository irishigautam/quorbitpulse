-- Migration 014: Candidate consent for LLM export analysis (Gate 1 — P0 launch)
--
-- Employers can upload a candidate's ChatGPT/Claude export for AI analysis
-- (lc8, /api/candidates/[id]/upload-llm-export). Previously this ran with no
-- candidate consent at all. This adds a full opt-in flow: employer requests
-- consent, candidate approves/denies via an emailed token link, and the
-- upload endpoint is gated on llm_consent_status = 'approved'.

ALTER TABLE imported_candidates
  ADD COLUMN IF NOT EXISTS llm_consent_status      TEXT NOT NULL DEFAULT 'none',
  -- none | pending | approved | denied
  ADD COLUMN IF NOT EXISTS llm_consent_token       TEXT,
  ADD COLUMN IF NOT EXISTS llm_consent_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llm_consent_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llm_consent_expires_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_imp_candidates_consent_token
  ON imported_candidates(llm_consent_token) WHERE llm_consent_token IS NOT NULL;

ALTER TABLE imported_candidates
  ADD CONSTRAINT chk_llm_consent_status
  CHECK (llm_consent_status IN ('none', 'pending', 'approved', 'denied'));
