/**
 * Job content fingerprinting — "Fingerprint Job" step of the distribution
 * flow, run right before Normalize Metadata / Connector Manager dispatch.
 *
 * Purpose: give every job a deterministic hash of its content-bearing
 * fields so the distribution pipeline (and the sync-status aggregate) can
 * tell "this job's content changed since it was last actually sent to
 * channels" from "nothing changed, no need to resync." Without this, a
 * recruiter editing a live job's description has no signal that LinkedIn/
 * Naukri/etc. are still serving the old copy until they manually notice.
 *
 * Deliberately NOT a random id or a per-post nonce — it must be the same
 * hash for the same content so it's meaningful to compare across edits.
 */

import crypto from 'crypto'
import type { Job } from '@/types'

export type FingerprintableJob = Pick<
  Job,
  | 'title'
  | 'description'
  | 'requirements'
  | 'location'
  | 'job_type'
  | 'remote'
  | 'skills'
  | 'domain'
  | 'min_experience'
  | 'salary_min'
  | 'salary_max'
  | 'salary_currency'
  | 'apply_url'
  | 'apply_email'
>

/**
 * Compute a stable sha256 fingerprint over every field that affects what an
 * external channel actually receives. Excludes operational fields (status,
 * views, posted_at, expires_at, distribution_channels) that change without
 * the job's actual content changing.
 */
export function computeJobFingerprint(job: FingerprintableJob): string {
  const normalized = {
    title: (job.title ?? '').trim().toLowerCase(),
    description: (job.description ?? '').trim(),
    requirements: job.requirements?.trim() || null,
    location: (job.location ?? '').trim().toLowerCase(),
    job_type: job.job_type,
    remote: !!job.remote,
    skills: Array.isArray(job.skills) ? [...job.skills].map(s => s.toLowerCase()).sort() : [],
    domain: Array.isArray(job.domain) ? [...job.domain].map(d => d.toLowerCase()).sort() : [],
    min_experience: job.min_experience ?? 0,
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    salary_currency: job.salary_currency ?? null,
    apply_url: job.apply_url?.trim() || null,
    apply_email: job.apply_email?.trim() || null,
  }
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
