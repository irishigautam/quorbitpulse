/**
 * Job distribution orchestrator.
 *
 * Always-on (feed, no credentials): google, indeed, glassdoor
 * Owned (recruiter's own account): linkedin, wellfound
 * Dual-mode — managed (Quorbit env creds) OR owned: naukri, shine, timesjobs, foundit, ziprecruiter
 * Quick post (never auto-distributed): iimjobs, hirist, internshala, apna, cutshort,
 *   instahyre, workindia, freshersworld, hirect
 */

import { createServiceClient } from '@/lib/supabase/server'
import { buildConnectorTasks } from './connector-manager'
import { computeJobFingerprint } from './fingerprint'
import { computeSyncStatus } from './sync-status'
import type { IntegrationConfig, PostResult } from '@/lib/integrations/handlers'
import type { Job, Company } from '@/types'

export interface DistributionReport {
  [platform: string]: PostResult
}

/**
 * Dispatch task map is now entirely registry-driven — see
 * lib/distribution/connector-manager.ts. Adding/removing a channel is a
 * CONNECTORS array edit there; this function no longer needs touching.
 */
async function buildTasks(
  job: Job,
  company: Company,
  configMap: Map<string, IntegrationConfig>
): Promise<Record<string, () => Promise<PostResult>>> {
  return buildConnectorTasks(job, company, configMap)
}

async function runTasksAndPersist(
  job: Job,
  company: Company,
  configMap: Map<string, IntegrationConfig>,
  tasks: Record<string, () => Promise<PostResult>>,
  existingReport: DistributionReport,
  opts: { isFullRun: boolean; existingDistributedFingerprint?: string | null } = { isFullRun: true }
): Promise<DistributionReport> {
  const supabase = createServiceClient()

  const entries = Object.entries(tasks)
  const results = await Promise.all(
    entries.map(([, fn]) =>
      fn().catch(e => ({
        status: 'error' as const,
        error: String(e),
        distributed_at: new Date().toISOString(),
      }))
    )
  )

  const freshReport: DistributionReport = Object.fromEntries(
    entries.map(([id], i) => [id, results[i]])
  )

  // Merge onto whatever was already recorded so channels not re-run (e.g. those
  // already 'ok', or intentionally skipped during a retry) are preserved.
  const report: DistributionReport = { ...existingReport, ...freshReport }

  // Fingerprint Job / Sync Status: `currentFingerprint` is the job's live
  // content hash (computed at create/edit/publish time). On a full run
  // (distributeJob / resyncJob) every channel just received that content, so
  // the distributed-fingerprint baseline moves forward to match. On a
  // partial retry (only previously-failed channels re-run) the channels that
  // were left untouched are still serving whatever content they last
  // actually received — advancing the baseline here would silently mark a
  // job "in sync" for content some channels never got, so retries keep
  // whatever baseline was already recorded instead.
  const currentFingerprint = job.fingerprint ?? computeJobFingerprint(job)
  const distributedFingerprint = opts.isFullRun
    ? currentFingerprint
    : (opts.existingDistributedFingerprint ?? currentFingerprint)
  const syncStatus = computeSyncStatus(report, currentFingerprint, distributedFingerprint)

  // Persist results
  try {
    await supabase
      .from('jobs')
      .update({
        distributed_at: new Date().toISOString(),
        distribution_channels: report,
        fingerprint: currentFingerprint,
        distributed_fingerprint: distributedFingerprint,
        sync_status: syncStatus,
      })
      .eq('id', job.id)

    const successIds = entries
      .filter((_, i) => results[i].status === 'ok')
      .map(([id]) => id)
      .filter(id => configMap.has(id))

    if (successIds.length > 0) {
      await supabase
        .from('integration_configs')
        .update({ last_used_at: new Date().toISOString() })
        .eq('company_id', company.id)
        .in('platform', successIds)
    }
  } catch (e) {
    console.error('[distribution] persist failed:', e)
  }

  const summary = Object.entries(report).map(([ch, r]) => `${ch}=${r.status}`).join(' ')
  console.log(`[distribution] job=${job.id} ${summary}`)

  return report
}

export async function distributeJob(
  job: Job,
  company: Company
): Promise<DistributionReport> {
  const supabase = createServiceClient()

  // Load all connected integrations (owned + managed) for this company
  const { data: configs } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'connected')

  const configMap = new Map<string, IntegrationConfig>(
    (configs ?? []).map((c: any) => [c.platform, c as IntegrationConfig])
  )

  const tasks = await buildTasks(job, company, configMap)
  return runTasksAndPersist(job, company, configMap, tasks, {}, { isFullRun: true })
}

/**
 * Resync — full re-run of every currently-configured channel, used when a
 * job's sync_status is 'stale' (content edited after the last distribution
 * run). Distinct entry point from distributeJob only for call-site clarity/
 * audit logging; behavior is identical — every channel gets the job's
 * current content and the distributed-fingerprint baseline advances to
 * match it.
 */
export const resyncJob = distributeJob

/**
 * P0-007 — Retry ONLY the channels that previously errored, leaving every
 * channel that already succeeded untouched. Re-running the full distributeJob
 * would risk duplicate postings on external boards that don't dedupe on their
 * end (e.g. re-submitting to LinkedIn/Naukri could create a second listing),
 * so this only re-invokes tasks for channels currently in 'error' status.
 */
export async function retryFailedChannels(
  job: Job,
  company: Company
): Promise<{ report: DistributionReport; retried: string[] }> {
  const supabase = createServiceClient()

  const { data: jobRow } = await supabase
    .from('jobs')
    .select('distribution_channels, distributed_fingerprint')
    .eq('id', job.id)
    .single()

  const existingReport: DistributionReport = (jobRow?.distribution_channels as DistributionReport) ?? {}
  const existingDistributedFingerprint: string | null = jobRow?.distributed_fingerprint ?? null

  const failedChannels = Object.entries(existingReport)
    .filter(([, r]) => r.status === 'error')
    .map(([id]) => id)

  if (failedChannels.length === 0) {
    return { report: existingReport, retried: [] }
  }

  const { data: configs } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'connected')

  const configMap = new Map<string, IntegrationConfig>(
    (configs ?? []).map((c: any) => [c.platform, c as IntegrationConfig])
  )

  const allTasks = await buildTasks(job, company, configMap)
  const retryTasks: Record<string, () => Promise<PostResult>> = {}
  for (const ch of failedChannels) {
    if (allTasks[ch]) retryTasks[ch] = allTasks[ch]
  }

  const retried = Object.keys(retryTasks)
  if (retried.length === 0) {
    return { report: existingReport, retried: [] }
  }

  const report = await runTasksAndPersist(job, company, configMap, retryTasks, existingReport, {
    isFullRun: false,
    existingDistributedFingerprint,
  })
  return { report, retried }
}

export function successCount(report: DistributionReport): number {
  return Object.values(report).filter(r => r.status === 'ok').length
}
