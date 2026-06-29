-- ============================================================
-- Phase 1: Candidate Import Engine
-- Run this in Supabase SQL editor
-- ============================================================

-- ── imported_candidates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS imported_candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  -- Raw import data
  full_name         TEXT NOT NULL,
  email             TEXT,
  linkedin_url      TEXT,
  current_title     TEXT,
  current_company   TEXT,
  location          TEXT,
  phone             TEXT,
  notes             TEXT,

  -- Import metadata
  import_source     TEXT NOT NULL DEFAULT 'csv',  -- csv | linkedin_ext | apollo | naukri_ext
  import_batch_id   UUID,
  raw_data          JSONB,

  -- AI-extracted fingerprint (populated by Phase 2 scoring engine)
  domain            TEXT[]  DEFAULT '{}',
  seniority         TEXT,   -- intern | junior | mid | senior | lead | principal
  skills            TEXT[]  DEFAULT '{}',
  years_experience  INTEGER,
  fingerprint_at    TIMESTAMPTZ, -- when fingerprint was last extracted

  -- Status
  status            TEXT NOT NULL DEFAULT 'new',  -- new | scored | chatted | in_pipeline | rejected | hired

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_imp_candidates_company     ON imported_candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_imp_candidates_email       ON imported_candidates(company_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imp_candidates_linkedin    ON imported_candidates(company_id, linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imp_candidates_status      ON imported_candidates(company_id, status);
CREATE INDEX IF NOT EXISTS idx_imp_candidates_source      ON imported_candidates(company_id, import_source);
CREATE INDEX IF NOT EXISTS idx_imp_candidates_batch       ON imported_candidates(import_batch_id) WHERE import_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_imp_candidates_created     ON imported_candidates(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imp_candidates_skills      ON imported_candidates USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_imp_candidates_domain      ON imported_candidates USING GIN(domain);

-- ── candidate_job_assignments ────────────────────────────────
CREATE TABLE IF NOT EXISTS candidate_job_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID REFERENCES imported_candidates(id) ON DELETE CASCADE NOT NULL,
  job_id            UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,

  -- Match scores (Phase 2 — AI Scoring Engine)
  match_score       INTEGER CHECK (match_score BETWEEN 0 AND 100),
  domain_score      INTEGER CHECK (domain_score BETWEEN 0 AND 100),
  seniority_score   INTEGER CHECK (seniority_score BETWEEN 0 AND 100),
  skill_score       INTEGER CHECK (skill_score BETWEEN 0 AND 100),
  experience_score  INTEGER CHECK (experience_score BETWEEN 0 AND 100),
  score_breakdown   JSONB,   -- detailed breakdown object

  -- LLM chat validation (Phase 3)
  chat_sent_at      TIMESTAMPTZ,
  chat_completed_at TIMESTAMPTZ,
  chat_score        INTEGER CHECK (chat_score BETWEEN 0 AND 100),
  chat_summary      TEXT,
  chat_transcript   JSONB,   -- [{role, content}] array

  -- Pipeline stage
  pipeline_stage    TEXT NOT NULL DEFAULT 'sourced',
  -- sourced | screened | interview | offer | hired | rejected

  -- ATS fields
  recruiter_notes   TEXT,
  tags              TEXT[]  DEFAULT '{}',
  starred           BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(candidate_id, job_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_job        ON candidate_job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_assignments_company    ON candidate_job_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_candidate  ON candidate_job_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assignments_stage      ON candidate_job_assignments(job_id, pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_assignments_score      ON candidate_job_assignments(job_id, match_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_assignments_tags       ON candidate_job_assignments USING GIN(tags);

-- ── import_batches ───────────────────────────────────────────
-- Tracks each import session for dedup and rollback
CREATE TABLE IF NOT EXISTS import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  source        TEXT NOT NULL DEFAULT 'csv',
  filename      TEXT,
  total_rows    INTEGER DEFAULT 0,
  inserted      INTEGER DEFAULT 0,
  skipped_dups  INTEGER DEFAULT 0,
  failed        INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'complete',  -- processing | complete | failed
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_company ON import_batches(company_id, created_at DESC);

-- ── RLS Policies ─────────────────────────────────────────────
ALTER TABLE imported_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches            ENABLE ROW LEVEL SECURITY;

-- Companies can only see their own candidates
CREATE POLICY "company_own_candidates" ON imported_candidates
  FOR ALL USING (
    company_id = (
      SELECT id FROM companies
      WHERE id = (SELECT (auth.jwt()->>'company_id')::uuid)
    )
  );

CREATE POLICY "company_own_assignments" ON candidate_job_assignments
  FOR ALL USING (
    company_id = (
      SELECT id FROM companies
      WHERE id = (SELECT (auth.jwt()->>'company_id')::uuid)
    )
  );

CREATE POLICY "company_own_batches" ON import_batches
  FOR ALL USING (
    company_id = (
      SELECT id FROM companies
      WHERE id = (SELECT (auth.jwt()->>'company_id')::uuid)
    )
  );

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_imp_candidates_updated
  BEFORE UPDATE ON imported_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_assignments_updated
  BEFORE UPDATE ON candidate_job_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
