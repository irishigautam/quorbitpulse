/**
 * Shared metadata normalization for outbound distribution.
 *
 * Before this, every channel module (indeed.ts, linkedin.ts, naukri.ts,
 * integrations/handlers.ts) independently re-implemented job-type mapping,
 * currency normalization, and experience-range padding — six separate
 * mapJobType* switch statements, three slightly different currency fallback
 * expressions, and three copies of the same "(min ?? 0) + 5" experience-max
 * heuristic. That duplication had already produced real bugs: TimesJobs'
 * inline `job.job_type === 'full_time' ? 1 : 2` silently mapped every
 * part-time/contract/internship/freelance role to the same code, and
 * Wellfound's payload hardcoded `currency: 'INR'` regardless of the job's
 * actual salary_currency.
 *
 * This module is intentionally NOT a single canonical vocabulary — each
 * external platform has its own job-type representation (LinkedIn wants
 * "Full-time", Indeed wants "fulltime", Naukri wants a numeric code). Rather
 * than force a shared enum, normalizeJobType() takes each channel's own
 * mapping table and returns one shared, tested lookup with a single fallback
 * behavior, so every channel gets a real mapping for every JobType instead of
 * an ad hoc partial switch.
 */

import type { Job, JobType } from '@/types'

/** Every job type must map to something for every channel — no silent fallthrough. */
export type JobTypeMap<T> = Record<JobType, T>

/**
 * Look up a channel-specific representation for a job type.
 * Falls back to the `full_time` entry if the job's type is somehow missing
 * (shouldn't happen — JobType is a closed union — but a live job row is only
 * as reliable as its check constraint).
 */
export function normalizeJobType<T>(jobType: JobType | string | null, map: JobTypeMap<T>): T {
  const key = (jobType ?? 'full_time') as JobType
  return map[key] ?? map.full_time
}

/**
 * Canonicalize a currency value to a 3-letter ISO code. Jobs created before
 * currency selection existed store a bare '₹' symbol; some channels also
 * received the literal symbol where an ISO code was expected. Every channel
 * that sends a `currency` field to an external API should normalize through
 * this instead of repeating the `=== '₹' ? 'INR' : ...` check inline.
 */
export function normalizeCurrencyCode(currency: string | null | undefined): string {
  if (!currency) return 'INR'
  const trimmed = currency.trim()
  if (trimmed === '₹') return 'INR'
  if (trimmed === '$') return 'USD'
  if (trimmed === '€') return 'EUR'
  if (trimmed === '£') return 'GBP'
  return trimmed.toUpperCase()
}

/**
 * Display-facing currency symbol for a normalized code — used by channels
 * that build a human-readable salary string (Indeed's XML description,
 * LinkedIn's post text) rather than a structured field.
 */
export function currencySymbol(currency: string | null | undefined): string {
  switch (normalizeCurrencyCode(currency)) {
    case 'USD': return '$'
    case 'EUR': return '€'
    case 'GBP': return '£'
    default: return '₹'
  }
}

/**
 * Several channels (Naukri, Shine, Foundit) ask for a min/max experience
 * range, but jobs only ever collect a single min_experience value. Every
 * channel independently padded the max by +5 years — extracted here so the
 * heuristic lives in one place and the spread is documented instead of a
 * bare magic number at three call sites.
 */
export function normalizeExperienceRange(
  minExperience: number | null | undefined,
  spreadYears = 5,
): { min: number; max: number } {
  const min = minExperience ?? 0
  return { min, max: min + spreadYears }
}

/** Human-readable "₹5.0L–8.0L per year" style string, or null if no salary set. */
export function formatSalaryDisplay(job: Pick<Job, 'salary_min' | 'salary_max' | 'salary_currency'>): string | null {
  if (!job.salary_min && !job.salary_max) return null
  const symbol = currencySymbol(job.salary_currency)
  const fmt = (n: number) => `${symbol}${n.toLocaleString()}`
  if (job.salary_min && job.salary_max) return `${fmt(job.salary_min)}–${fmt(job.salary_max)} per year`
  if (job.salary_min) return `From ${fmt(job.salary_min)} per year`
  return `Up to ${fmt(job.salary_max!)} per year`
}
