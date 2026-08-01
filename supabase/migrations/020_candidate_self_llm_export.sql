-- Candidate flow gap: "Upload AI Work History" only ever existed as a
-- recruiter-triggered, consent-gated feature on imported_candidates
-- (app/api/candidates/[id]/upload-llm-export). Candidates had no
-- self-service way to upload their own ChatGPT/Claude export. Since this is
-- the candidate uploading their own data about themselves, no consent gate
-- is needed here (unlike the recruiter-initiated flow).
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS llm_export_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS llm_export_summary TEXT,
  ADD COLUMN IF NOT EXISTS llm_export_source TEXT;
