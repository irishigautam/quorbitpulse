/**
 * s4 — Source attribution and deduplication for job listings.
 * Uses a SHA-256 hash of (title + company_name + location) to detect duplicates
 * across sources (Adzuna, schema.org, Apify).
 */

import { createHash } from 'crypto'

export interface RawJobListing {
  title: string
  company_name: string
  location: string
  description: string | null
  url: string
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string
  remote?: boolean
  posted_at?: string | null
  expires_at?: string | null
  source: 'adzuna' | 'schema_org' | 'apify' | 'direct'
  external_id?: string | null
  skills?: string[]
  domain?: string[]
  min_experience?: number | null
}

/**
 * Compute a stable dedup hash from the canonical identity fields.
 * Lowercases and trims to normalise minor formatting differences.
 */
export function computeDedupHash(title: string, companyName: string, location: string): string {
  const canonical = [title, companyName, location]
    .map(s => s.toLowerCase().trim().replace(/\s+/g, ' '))
    .join('|')
  return createHash('sha256').update(canonical).digest('hex').slice(0, 40)
}

/**
 * Prepare job listings for upsert — attaches dedup_hash and normalises source attribution.
 * Caller is responsible for DB upsert with conflict on dedup_hash.
 */
export function prepareForUpsert(jobs: RawJobListing[]) {
  return jobs.map(job => ({
    external_id:     job.external_id ?? null,
    source:          job.source,
    title:           job.title.trim(),
    company_name:    job.company_name.trim(),
    location:        job.location.trim(),
    description:     job.description?.slice(0, 5000) ?? null,
    url:             job.url,
    salary_min:      job.salary_min ?? null,
    salary_max:      job.salary_max ?? null,
    salary_currency: job.salary_currency ?? 'INR',
    remote:          job.remote ?? false,
    posted_at:       job.posted_at ?? null,
    expires_at:      job.expires_at ?? null,
    skills:          job.skills ?? [],
    domain:          job.domain ?? [],
    min_experience:  job.min_experience ?? null,
    enriched:        (job.skills?.length ?? 0) > 0,
    dedup_hash:      computeDedupHash(job.title, job.company_name, job.location),
  }))
}
