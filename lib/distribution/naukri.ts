/**
 * Naukri distribution channel.
 *
 * Uses the Naukri RMS REST API.
 * Requires a Naukri recruiter account with API access enabled.
 * Set NAUKRI_API_KEY and NAUKRI_CLIENT_ID in Vercel env vars
 * OR let each company provide their own key via Settings → Distribution.
 *
 * Docs: https://developer.naukri.com/docs/job-posting-api
 */

import type { Job, Company } from '@/types'
import type { DistributionResult } from './indeed'
import type { IntegrationConfig } from '@/lib/integrations/handlers'
import { normalizeJobType, normalizeCurrencyCode, normalizeExperienceRange } from './normalize'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'
const NAUKRI_API = 'https://www.naukri.com/jobapi/v1'

export async function distributeToNaukri(
  job: Job,
  company: Company,
  config?: IntegrationConfig
): Promise<DistributionResult> {
  // Use provided config (owned or managed), or fall back to env vars for backward compat
  const apiKey = config?.api_key ?? process.env.NAUKRI_API_KEY
  const clientId = config?.extra_key ?? process.env.NAUKRI_CLIENT_ID

  if (!apiKey || !clientId) {
    return {
      status: 'skipped',
      error: 'Naukri API key not configured — connect your account in Integrations.',
      distributed_at: new Date().toISOString(),
    }
  }

  const applyUrl = job.apply_url ?? `${APP_URL}/jobs/${job.id}`
  const experience = normalizeExperienceRange(job.min_experience)

  const payload = {
    title: job.title,
    description: job.description,
    location: [job.location],
    jobType: normalizeJobType(job.job_type, NAUKRI_JOB_TYPE_MAP),
    workFromHome: job.remote ? 1 : 0,
    minExperience: experience.min,
    maxExperience: experience.max,
    minSalary: job.salary_min ?? undefined,
    maxSalary: job.salary_max ?? undefined,
    currency: normalizeCurrencyCode(job.salary_currency),
    keySkills: Array.isArray(job.skills) ? (job.skills as string[]).slice(0, 10) : [],
    applyUrl,
    noOfOpenings: 1,
    companyName: company.name,
    expiryDate: job.expires_at
      ? new Date(job.expires_at).toISOString().split('T')[0]
      : undefined,
  }

  try {
    const res = await fetch(`${NAUKRI_API}/jobs`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'X-CLIENT-ID': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text()
      return {
        status: 'error',
        error: `Naukri API ${res.status}: ${err}`,
        distributed_at: new Date().toISOString(),
      }
    }

    const data = await res.json()
    const naukriJobId = data?.jobId ?? data?.id
    const postUrl = naukriJobId
      ? `https://www.naukri.com/job-listings-${job.title.toLowerCase().replace(/\s+/g, '-')}-${naukriJobId}`
      : undefined

    return {
      status: 'ok',
      url: postUrl,
      distributed_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      status: 'error',
      error: String(err),
      distributed_at: new Date().toISOString(),
    }
  }
}

// Naukri job type codes
const NAUKRI_JOB_TYPE_MAP = {
  full_time: 1,
  part_time: 2,
  contract: 3,
  internship: 9,
  freelance: 3,
}
