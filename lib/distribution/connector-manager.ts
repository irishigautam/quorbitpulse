/**
 * Connector Manager — single registry-driven dispatch table for outbound
 * distribution.
 *
 * Before this, lib/distribution/index.ts's buildTasks() had one hardcoded
 * `if (configMap.has('naukri')) tasks.naukri = () => ...` line per channel,
 * plus 3 more always-on channels inlined directly in the function body.
 * Adding a new channel meant editing that function; the "which channels
 * exist" list lived in a comment at the top of index.ts, separate from the
 * actual dispatch code and separate again from lib/integrations/registry.ts
 * (the UI-facing list of the same platforms). Three sources of truth for
 * the same set of channels.
 *
 * This module is now the one place a channel is wired into the actual
 * distribution run: every entry in CONNECTORS pairs a platform id with its
 * handler function and whether it needs a stored integration_configs row.
 * index.ts's buildTasks() just loops over this list — no channel-specific
 * code lives there anymore. lib/integrations/registry.ts remains the
 * separate UI-facing catalog (logos, descriptions, connect flows); the two
 * overlap in id but serve different concerns (what a channel IS to a
 * recruiter vs. how it's actually invoked), so they're kept distinct rather
 * than merged into one god-object.
 */

import { distributeToIndeed } from './indeed'
import { distributeToLinkedIn } from './linkedin'
import { distributeToNaukri } from './naukri'
import {
  postToShine,
  postToTimesJobs,
  postToFoundit,
  postToZipRecruiter,
  postToWellfound,
  type IntegrationConfig,
  type PostResult,
} from '@/lib/integrations/handlers'
import type { Job, Company } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'

export type ConnectorHandler = (
  job: Job,
  company: Company,
  config?: IntegrationConfig,
) => Promise<PostResult>

export interface ConnectorEntry {
  id: string
  /** Always-on feed channels run with no integration_configs row at all. */
  alwaysOn: boolean
  handler: ConnectorHandler
}

/**
 * For managed-mode integration configs, inject platform-level env var
 * credentials. For owned-mode configs, return unchanged. Kept here (rather
 * than per-channel) since it's about how the manager resolves a config
 * before dispatch, not about any one channel's request shape.
 */
const MANAGED_CREDS: Record<string, { key: string; extra?: string }> = {
  shine:        { key: process.env.SHINE_API_KEY ?? '',       extra: process.env.SHINE_RECRUITER_ID ?? '' },
  timesjobs:    { key: process.env.TIMESJOBS_API_KEY ?? '',   extra: process.env.TIMESJOBS_PARTNER_ID ?? '' },
  foundit:      { key: process.env.FOUNDIT_API_KEY ?? '',     extra: process.env.FOUNDIT_RECRUITER_ID ?? '' },
  ziprecruiter: { key: process.env.ZIPRECRUITER_API_KEY ?? '' },
}

export function resolveManagedConfig(cfg: IntegrationConfig, platform: string): IntegrationConfig {
  if (cfg.mode !== 'managed') return cfg
  const creds = MANAGED_CREDS[platform]
  if (!creds) return cfg
  return {
    ...cfg,
    api_key: creds.key || cfg.api_key,
    extra_key: creds.extra !== undefined ? (creds.extra || cfg.extra_key) : cfg.extra_key,
  }
}

export const CONNECTORS: ConnectorEntry[] = [
  // ── Always-on feed platforms — no integration_configs row needed ──────
  {
    id: 'google',
    alwaysOn: true,
    handler: async job => ({
      status: 'ok',
      url: `${APP_URL}/jobs/${job.id}`,
      distributed_at: new Date().toISOString(),
    }),
  },
  {
    id: 'indeed',
    alwaysOn: true,
    handler: (job, company) => distributeToIndeed(job, company),
  },
  {
    id: 'glassdoor',
    alwaysOn: true,
    handler: async () => ({
      status: 'ok',
      url: `${APP_URL}/api/feeds/indeed`,
      distributed_at: new Date().toISOString(),
    }),
  },

  // ── Owned + managed connections — require a connected integration_configs row ──
  {
    id: 'linkedin',
    alwaysOn: false,
    handler: (job, company, cfg) => distributeToLinkedIn(job, company, cfg),
  },
  {
    id: 'wellfound',
    alwaysOn: false,
    handler: (job, _company, cfg) => postToWellfound(job, cfg!),
  },
  {
    id: 'naukri',
    alwaysOn: false,
    handler: (job, company, cfg) => distributeToNaukri(job, company, cfg),
  },
  {
    id: 'shine',
    alwaysOn: false,
    handler: (job, _company, cfg) => postToShine(job, resolveManagedConfig(cfg!, 'shine')),
  },
  {
    id: 'timesjobs',
    alwaysOn: false,
    handler: (job, _company, cfg) => postToTimesJobs(job, resolveManagedConfig(cfg!, 'timesjobs')),
  },
  {
    id: 'foundit',
    alwaysOn: false,
    handler: (job, _company, cfg) => postToFoundit(job, resolveManagedConfig(cfg!, 'foundit')),
  },
  {
    id: 'ziprecruiter',
    alwaysOn: false,
    handler: (job, _company, cfg) => postToZipRecruiter(job, resolveManagedConfig(cfg!, 'ziprecruiter')),
  },
]

export function getConnector(id: string): ConnectorEntry | undefined {
  return CONNECTORS.find(c => c.id === id)
}

export function listConnectorIds(): string[] {
  return CONNECTORS.map(c => c.id)
}

/**
 * Build the dispatch task map for a job: every always-on connector runs
 * unconditionally, every configured (owned/managed, status='connected')
 * connector runs if present in configMap. This is the entire "which
 * channels fire for this job" decision — adding a channel to CONNECTORS is
 * now the only change needed to wire it into real distribution runs.
 */
export function buildConnectorTasks(
  job: Job,
  company: Company,
  configMap: Map<string, IntegrationConfig>,
): Record<string, () => Promise<PostResult>> {
  const tasks: Record<string, () => Promise<PostResult>> = {}
  for (const connector of CONNECTORS) {
    if (connector.alwaysOn) {
      tasks[connector.id] = () => connector.handler(job, company)
    } else if (configMap.has(connector.id)) {
      tasks[connector.id] = () => connector.handler(job, company, configMap.get(connector.id))
    }
  }
  return tasks
}
