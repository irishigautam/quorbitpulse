/**
 * Job distribution orchestrator — v2.
 *
 * Reads connected integrations from the integration_configs table and fans out
 * to all active platforms in parallel. Results are saved back to jobs.distribution_channels.
 *
 * Auto-active (no config needed): google, indeed, glassdoor (feed)
 * OAuth-based: linkedin, wellfound
 * API-key-based: naukri, shine, timesjobs, ziprecruiter
 * Quick Post (no auto-distribute): iimjobs, hirist, internshala, apna, cutshort
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

export async function distributeJob(
  job: Job,
  company: Company
): Promise<DistributionReport> {
  const supabase = createServiceClient()

  // Load all connected integrations for this company
  const { data: configs } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'connected')

  const configMap = new Map<string, IntegrationConfig>(
    (configs ?? []).map((c: any) => [c.platform, c as IntegrationConfig])
  )

  const get = (id: string): IntegrationConfig =>
    configMap.get(id) ?? { platform: id, status: 'disconnected' }

  // Build task list — auto-active + any connected platform
  const tasks: Record<string, () => Promise<PostResult>> = {
    google: async () => ({
      status: 'ok' as const,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/jobs/${job.id}`,
      distributed_at: new Date().toISOString(),
    }),
    indeed: () => distributeToIndeed(job, company),
    glassdoor: async () => ({
      // Glassdoor ingests the Indeed XML feed; no separate call needed
      status: 'ok' as const,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/feeds/indeed`,
      distributed_at: new Date().toISOString(),
    }),
  }

  // Add connected OAuth / API-key platforms
  if (configMap.has('linkedin')) tasks.linkedin = () => distributeToLinkedIn(job, company)
  if (configMap.has('wellfound')) tasks.wellfound = () => postToWellfound(job, get('wellfound'))
  if (configMap.has('naukri')) tasks.naukri = () => distributeToNaukri(job, company)
  if (configMap.has('shine')) tasks.shine = () => postToShine(job, get('shine'))
  if (configMap.has('timesjobs')) tasks.timesjobs = () => postToTimesJobs(job, get('timesjobs'))
  if (configMap.has('ziprecruiter')) tasks.ziprecruiter = () => postToZipRecruiter(job, get('ziprecruiter'))

  // Run all in parallel
  const entries = Object.entries(tasks)
  const results = await Promise.all(entries.map(([, fn]) => fn().catch(e => ({
    status: 'error' as const,
    error: String(e),
    distributed_at: new Date().toISOString(),
  }))))

  const report: DistributionReport = Object.fromEntries(
    entries.map(([id], i) => [id, results[i]])
  )

  // Persist results to DB (best-effort)
  try {
    await supabase
      .from('jobs')
      .update({
        distributed_at: new Date().toISOString(),
        distribution_channels: report,
      })
      .eq('id', job.id)

    // Update last_used_at for connected platforms
    const successIds = entries
      .filter((_, i) => results[i].status === 'ok')
      .map(([id]) => id)

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

  const summary = Object.entries(report)
    .map(([ch, r]) => `${ch}=${r.status}`)
    .join(' ')
  console.log(`[distribution] job=${job.id} ${summary}`)

  return report
}

export function successCount(report: DistributionReport): number {
  return Object.values(report).filter(r => r.status === 'ok').length
}
