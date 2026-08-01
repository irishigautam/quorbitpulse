-- Distribution flow: Fingerprint Job + Sync Status gaps.
--
-- fingerprint: deterministic hash of the job's content-bearing fields,
-- recomputed on every create/edit. Used to detect when a published job's
-- content has changed since it was last actually sent to distribution
-- channels (dedup/change-detection, per the "Fingerprint Job" step in the
-- distribution flow diagram).
--
-- distributed_fingerprint: the fingerprint value that was current at the
-- moment distributeJob()/retryFailedChannels() last ran. Compared against
-- the live `fingerprint` to detect drift (job edited after publish, not yet
-- resynced).
--
-- sync_status: aggregate distribution state for the whole job, computed from
-- distribution_channels + the fingerprint comparison above. One badge
-- instead of only per-channel pills — the "Sync Status" / "Published" step
-- in the distribution flow diagram.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS distributed_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'not_distributed';
