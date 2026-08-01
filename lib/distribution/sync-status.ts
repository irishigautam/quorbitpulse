/**
 * Aggregate distribution sync status — the "Sync Status → Published" step
 * of the distribution flow diagram.
 *
 * Gate 5 already gave per-channel visibility (green/red/gray pills on each
 * job card), but there was no single answer to "is this job actually fully
 * live everywhere?" without manually scanning every pill. This computes one
 * job-level status from the same distribution_channels report plus the
 * fingerprint drift check from lib/distribution/fingerprint.ts.
 */

import type { DistributionReport } from './index'

export type SyncStatus =
  | 'not_distributed' // never run (draft, or distribution hasn't fired yet)
  | 'stale'           // job content edited since the last successful distribution run
  | 'synced'          // every channel that was attempted is 'ok' (skipped channels don't count against this)
  | 'partial'         // some channels ok, some error
  | 'failed'          // every attempted channel errored

/**
 * Compute the aggregate status from a distribution_channels report and the
 * job's current vs. last-distributed fingerprint. Called both right after a
 * distribution run (report freshly written, fingerprints necessarily equal)
 * and whenever a job is edited (report unchanged, fingerprints may now
 * differ — that's what flags 'stale').
 */
export function computeSyncStatus(
  report: DistributionReport | null | undefined,
  currentFingerprint: string | null | undefined,
  distributedFingerprint: string | null | undefined,
): SyncStatus {
  const entries = report ? Object.values(report) : []
  if (entries.length === 0) return 'not_distributed'

  // Fingerprint drift takes priority over the (now-outdated) per-channel
  // results — those results describe content that no longer matches what's
  // saved, regardless of whether they were 'ok' at the time.
  if (currentFingerprint && distributedFingerprint && currentFingerprint !== distributedFingerprint) {
    return 'stale'
  }

  const attempted = entries.filter(r => r.status !== 'skipped')
  if (attempted.length === 0) return 'not_distributed'

  const okCount = attempted.filter(r => r.status === 'ok').length
  if (okCount === attempted.length) return 'synced'
  if (okCount === 0) return 'failed'
  return 'partial'
}

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  not_distributed: 'Not distributed',
  stale: 'Content changed — resync needed',
  synced: 'Synced everywhere',
  partial: 'Partially synced',
  failed: 'Sync failed',
}

export const SYNC_STATUS_COLOR: Record<SyncStatus, { bg: string; fg: string }> = {
  not_distributed: { bg: '#F3F4F6', fg: '#6B7280' },
  stale:           { bg: '#EDE9FE', fg: '#6D28D9' },
  synced:          { bg: '#DCFCE7', fg: '#166534' },
  partial:         { bg: '#FEF3C7', fg: '#92400E' },
  failed:          { bg: '#FEE2E2', fg: '#991B1B' },
}
