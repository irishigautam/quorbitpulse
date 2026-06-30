/**
 * mo3–mo5 — Subscription tier gates and usage metering.
 *
 * Plan tiers:
 *   starter  — 50 imports/mo, 20 chats/mo, 3 jobs
 *   growth   — 250 imports/mo, 100 chats/mo, 10 jobs
 *   scale    — unlimited imports, unlimited chats, 50 jobs
 */

import { createServiceClient } from '@/lib/supabase/server'
import type { PlanTier, PlanLimits } from '@/types'

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: { imports_per_month: 50,  chats_per_month: 20,  jobs_quota: 3  },
  growth:  { imports_per_month: 250, chats_per_month: 100, jobs_quota: 10 },
  scale:   { imports_per_month: -1,  chats_per_month: -1,  jobs_quota: 50 },
}

export interface UsageCount {
  imports: number
  chats: number
}

/** Return usage counts for the current calendar month */
export async function getMonthlyUsage(companyId: string): Promise<UsageCount> {
  const supabase = createServiceClient()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('usage_events')
    .select('event_type')
    .eq('company_id', companyId)
    .gte('created_at', monthStart.toISOString())

  const events = data ?? []
  return {
    imports: events.filter(e => e.event_type === 'import').length,
    chats:   events.filter(e => e.event_type === 'chat').length,
  }
}

/** Get plan tier from company row (defaults to 'starter') */
export function getTier(company: any): PlanTier {
  return (company.plan_tier as PlanTier) ?? 'starter'
}

export function getLimits(company: any): PlanLimits {
  return PLAN_LIMITS[getTier(company)]
}

/** Check if a company is within limit for an event type */
export async function checkLimit(
  companyId: string,
  company: any,
  eventType: 'import' | 'chat'
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = getLimits(company)
  const limit = eventType === 'import' ? limits.imports_per_month : limits.chats_per_month

  if (limit === -1) return { allowed: true, current: 0, limit: -1 }

  const usage = await getMonthlyUsage(companyId)
  const current = eventType === 'import' ? usage.imports : usage.chats
  return { allowed: current < limit, current, limit }
}

/** Record a usage event */
export async function recordUsage(
  companyId: string,
  eventType: 'import' | 'chat' | 'score',
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('usage_events').insert({
    company_id: companyId,
    event_type: eventType,
    metadata,
  })
}
