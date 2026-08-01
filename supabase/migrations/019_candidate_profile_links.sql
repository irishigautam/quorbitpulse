-- Candidate flow gap: only linkedin_url existed as an editable professional
-- link. portfolio_url and github_url are the other two links called out in
-- the candidate flow diagram's "(Optional) Professional Links" step.
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT;
