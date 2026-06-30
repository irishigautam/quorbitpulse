/**
 * Per-platform job posting handlers.
 * Each handler receives the job, company, and the platform's integration config,
 * and returns a DistributionResult.
 */

import type { Job } from '@/types'

export interface IntegrationConfig {
  platform: string
  status: string
  access_token?: string | null
  refresh_token?: string | null
  api_key?: string | null
  extra_key?: string | null
  config?: Record<string, unknown>
  expires_at?: string | null
}

export interface PostResult {
  status: 'ok' | 'error' | 'skipped'
  url?: string
  error?: string
  distributed_at: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'

// ── Shine.com ────────────────────────────────────────────────────────────────

export async function postToShine(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key || !config.extra_key) {
    return skip('Shine API key not configured')
  }

  const payload = {
    jobTitle: job.title,
    jobDescription: job.description,
    jobLocation: job.location,
    jobType: mapJobTypeShine(job.job_type),
    minExperience: job.min_experience ?? 0,
    maxExperience: (job.min_experience ?? 0) + 5,
    minSalary: job.salary_min ?? undefined,
    maxSalary: job.salary_max ?? undefined,
    keySkills: Array.isArray(job.skills) ? (job.skills as string[]).join(',') : '',
    workFromHome: job.remote ? 'Y' : 'N',
    applyUrl: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
    expiryDate: job.expires_at ? job.expires_at.split('T')[0] : undefined,
  }

  try {
    const res = await fetch('https://api.shine.com/v2/jobs', {
      method: 'POST',
      headers: {
        'X-API-KEY': config.api_key,
        'X-RECRUITER-ID': config.extra_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return err(`Shine API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    return ok(data?.jobUrl ?? `https://www.shine.com/job-search/`)
  } catch (e) {
    return err(String(e))
  }
}

function mapJobTypeShine(type: string | null): string {
  switch (type) {
    case 'full_time': return 'Full Time'
    case 'part_time': return 'Part Time'
    case 'contract': return 'Contract/Temp'
    case 'internship': return 'Internship'
    default: return 'Full Time'
  }
}

// ── TimesJobs ────────────────────────────────────────────────────────────────

export async function postToTimesJobs(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key || !config.extra_key) {
    return skip('TimesJobs API key not configured')
  }

  const payload = {
    jobtitle: job.title,
    jobdescription: job.description,
    joblocation: job.location,
    jobtype: job.job_type === 'full_time' ? 1 : 2,
    minexp: job.min_experience ?? 0,
    maxexp: (job.min_experience ?? 0) + 5,
    minsal: job.salary_min ?? undefined,
    maxsal: job.salary_max ?? undefined,
    skills: Array.isArray(job.skills) ? job.skills : [],
    wfh: job.remote ? 1 : 0,
    apply_url: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
  }

  try {
    const res = await fetch('https://www.timesjobs.com/api/v1/postjob', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.api_key}`,
        'X-Partner-ID': config.extra_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return err(`TimesJobs API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    return ok(data?.jobUrl)
  } catch (e) {
    return err(String(e))
  }
}

// ── ZipRecruiter ─────────────────────────────────────────────────────────────

export async function postToZipRecruiter(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key) {
    return skip('ZipRecruiter API key not configured')
  }

  const payload = {
    job: {
      title: job.title,
      description: job.description,
      location: job.remote ? 'Remote' : job.location,
      employment_type: mapJobTypeZip(job.job_type),
      remote: job.remote ?? false,
      salary_min: job.salary_min ?? undefined,
      salary_max: job.salary_max ?? undefined,
      apply_url: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
    },
  }

  try {
    const res = await fetch(`https://api.ziprecruiter.com/jobs/v1?api_key=${config.api_key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return err(`ZipRecruiter API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    return ok(data?.job_url ?? `https://www.ziprecruiter.com/jobs/search?q=${encodeURIComponent(job.title)}`)
  } catch (e) {
    return err(String(e))
  }
}

function mapJobTypeZip(type: string | null): string {
  switch (type) {
    case 'full_time': return 'full_time'
    case 'part_time': return 'part_time'
    case 'contract': return 'contractor'
    case 'internship': return 'intern'
    default: return 'full_time'
  }
}

// ── Wellfound (AngelList) ─────────────────────────────────────────────────────

export async function postToWellfound(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.access_token) {
    return skip('Wellfound not connected')
  }

  if (config.expires_at && new Date(config.expires_at) < new Date()) {
    return err('Wellfound token expired — reconnect in Settings → Integrations')
  }

  const payload = {
    title: job.title,
    description: job.description,
    job_type: mapJobTypeWellfound(job.job_type),
    location_type: job.remote ? 'remote' : 'onsite',
    location: job.location,
    skills: Array.isArray(job.skills) ? job.skills : [],
    min_years_experience: job.min_experience ?? 0,
    apply_url: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
    compensation: job.salary_min
      ? { min: job.salary_min, max: job.salary_max ?? job.salary_min, currency: 'INR' }
      : undefined,
  }

  try {
    const res = await fetch('https://api.wellfound.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation CreateJob($input: JobInput!) {
            createJob(input: $input) {
              id
              slug
              liveStartAt
            }
          }
        `,
        variables: { input: payload },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return err(`Wellfound API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const jobSlug = data?.data?.createJob?.slug
    return ok(jobSlug ? `https://wellfound.com/jobs/${jobSlug}` : undefined)
  } catch (e) {
    return err(String(e))
  }
}

function mapJobTypeWellfound(type: string | null): string {
  switch (type) {
    case 'full_time': return 'full_time'
    case 'part_time': return 'part_time'
    case 'contract': return 'contract'
    case 'internship': return 'internship'
    default: return 'full_time'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(url?: string): PostResult {
  return { status: 'ok', url, distributed_at: new Date().toISOString() }
}
function err(error: string): PostResult {
  return { status: 'error', error, distributed_at: new Date().toISOString() }
}
function skip(error: string): PostResult {
  return { status: 'skipped', error, distributed_at: new Date().toISOString() }
}

/** Build a Quick Post URL for platforms with no API */
export function buildQuickPostUrl(template: string, job: Job, companyName: string): string {
  return template
    .replace('{title}', encodeURIComponent(job.title))
    .replace('{company}', encodeURIComponent(companyName))
    .replace('{location}', encodeURIComponent(job.location))
    .replace('{description}', encodeURIComponent(job.description.slice(0, 500)))
}
