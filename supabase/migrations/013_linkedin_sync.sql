-- Migration 013: LinkedIn sync fields on candidate_profiles
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS projects       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS publications   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_synced_at TIMESTAMPTZ;
