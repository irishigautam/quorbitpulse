/**
 * Job distribution orchestrator.
 *
 * Always-on (feed, no credentials): google, indeed, glassdoor
 * Owned (recruiter's own account): linkedin, wellfound
 * Dual-mode — managed (Quorbit env creds) OR owned: naukri, shine, timesjobs, ziprecruiter
 * Quick post (never auto-distributed): iimjobs, hirist, internshala, apna, cutshort
 */

import { createServiceClient } from '@/lib/supabase/server'
import { distributeToIndeed } from './indeed'
import { distributeToLinkedIn } from './linkedin'
import { distributeToNaukri } from './naukri'
import {
  postToShine,
  postToTimesJobs,
  postToZipRecruiter,
  postToWellfound,
  type IntegrationConfig,
  type PostResult,
} from '@/lib/integrations/handlers'
import type { Job } from '@/types'
import type { Database } from '@/types/supabase'

type Company = Database['public']['Tables']['companies']['Row']

export interface DistributionReport {
  [platform: string]: PostResult
}

/**
 * For managed-mode integration configs, inject platform-level env var credentials.
 * For owned-mode configs, return unchanged.
 */
const MANAGED_CREDS: Record<string, { key: string; extra?: string }> = {
  shine:        { key: process.env.SHINE_API_KEY ?? '',       extra: process.env.SHINE_RECRUITER_ID ?? '' },
  timesjobs:    { key: process.env.TIMESJOBS_API_KEY ?? '',   extra: process.env.TIMESJOBS_PARTNER_ID ?? '' },
  ziprecruiter: { key: process.env.ZIPRECRUITER_API_KEY ?? '' },
}

function resolveManagedConfig(cfg: IntegrationConfig, platform: string): IntegrationConfig {
  if (cfg.mode !== 'managed') return cfg
  const creds = MANAGED_CREDS[platform]
  if (!creds) return cfg
  return {
    ...cfg,
    api_key: creds.key || cfg.api_key,
    extra_key: creds.extra !== undefined ? (creds.extra || cfg.extra_key) : cfg.extra_key,
  }
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

  const tasks: Record<string, () => Promise<PostResult>> = {}

  // ── Always-on feed platforms ─────────────────────────────────────
  tasks.google = async () => ({
    status: 'ok' as const,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jobs/${job.id}`,
    distributed_at: new Date().toISOString(),
  })

  tasks.indeed = () => distributeToIndeed(job, company)

  tasks.glassdoor = async () => ({
    status: 'ok' as const,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/feeds/indeed`,
    distributed_at: new Date().toISOString(),
  })

  // ── Owned + managed connections ───────────────────────────────────
  if (configMap.has('linkedin'))    tasks.linkedin    = () => distributeToLinkedIn(job, company)
  if (configMap.has('wellfound'))   tasks.wellfound   = () => postToWellfound(job, configMap.get('wellfound')!)
  if (configMap.has('naukri'))      tasks.naukri      = () => distributeToNaukri(job, company, configMap.get('naukri'))
  if (configMap.has('shine'))       tasks.shine       = () => postToShine(job, resolveManagedConfig(configMap.get('shine')!, 'shine'))
  if (configMap.has('timesjobs'))   tasks.timesjobs   = () => postToTimesJobs(job, resolveManagedConfig(configMap.get('timesjobs')!, 'timesjobs'))
  if (configMap.has('ziprecruiter')) tasks.ziprecruiter = () => postToZipRecruiter(job, resolveManagedConfig(configMap.get('ziprecruiter')!, 'ziprecruiter'))

  // Run all in parallel
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

  const report: DistributionReport = Object.fromEntries(
    entries.map(([id], i) => [id, results[i]])
  )

  // Persist results
  try {
    await supabase
      .from('jobs')
      .update({
        distributed_at: new Date().toISOString(),
        distribution_channels: report,
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

export function successCount(report: DistributionReport): number {
  return Object.values(report).filter(r => r.status === 'ok').length
}
