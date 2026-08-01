/**
 * Per-platform job posting handlers.
 * Each handler receives the job, company, and the platform's integration config,
 * and returns a DistributionResult.
 */

import type { Job } from '@/types'
import { normalizeJobType, normalizeCurrencyCode, normalizeExperienceRange } from '@/lib/distribution/normalize'

export interface IntegrationConfig {
  platform: string
  status: string
  mode?: string | null        // 'owned' | 'managed' | null
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'

// ── Shine.com ────────────────────────────────────────────────────────────────

export async function postToShine(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key || !config.extra_key) {
    return skip('Shine API key not configured')
  }

  const shineExperience = normalizeExperienceRange(job.min_experience)
  const payload = {
    jobTitle: job.title,
    jobDescription: job.description,
    jobLocation: job.location,
    jobType: normalizeJobType(job.job_type, SHINE_JOB_TYPE_MAP),
    minExperience: shineExperience.min,
    maxExperience: shineExperience.max,
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

const SHINE_JOB_TYPE_MAP = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract/Temp',
  internship: 'Internship',
  // Not covered by the old switch (silently fell through to 'Full Time') —
  // 'Contract/Temp' is the closer match of Shine's actual categories.
  freelance: 'Contract/Temp',
}

// ── Foundit (Monster India) ───────────────────────────────────────────────────

export async function postToFoundit(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key || !config.extra_key) {
    return skip('Foundit API key not configured')
  }

  const founditExperience = normalizeExperienceRange(job.min_experience)
  const payload = {
    jobTitle: job.title,
    jobDescription: job.description,
    location: [job.location],
    jobType: normalizeJobType(job.job_type, FOUNDIT_JOB_TYPE_MAP),
    isRemote: !!job.remote,
    minExperienceYrs: founditExperience.min,
    maxExperienceYrs: founditExperience.max,
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    currency: normalizeCurrencyCode(job.salary_currency),
    skills: Array.isArray(job.skills) ? (job.skills as string[]).slice(0, 15) : [],
    applyUrl: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
    openings: 1,
    expiryDate: job.expires_at ? job.expires_at.split('T')[0] : undefined,
  }

  try {
    const res = await fetch('https://api.foundit.in/recruiter/v1/jobs', {
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
      return err(`Foundit API ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const jobId = data?.jobId ?? data?.id
    return ok(jobId ? `https://www.foundit.in/job/${jobId}` : undefined)
  } catch (e) {
    return err(String(e))
  }
}

const FOUNDIT_JOB_TYPE_MAP = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACT',
  internship: 'INTERNSHIP',
  freelance: 'CONTRACT',
}

// ── TimesJobs ────────────────────────────────────────────────────────────────

export async function postToTimesJobs(job: Job, config: IntegrationConfig): Promise<PostResult> {
  if (!config.api_key || !config.extra_key) {
    return skip('TimesJobs API key not configured')
  }

  const timesJobsExperience = normalizeExperienceRange(job.min_experience)
  const payload = {
    jobtitle: job.title,
    jobdescription: job.description,
    joblocation: job.location,
    // Previously `job.job_type === 'full_time' ? 1 : 2` — every non-full-time
    // role (part-time, contract, internship, freelance) collapsed to the same
    // code 2, a real bug. TimesJobs' actual code scheme isn't documented
    // anywhere in this codebase (this integration has never gone through a
    // real sandbox test) — reusing Naukri's numeric scheme here is a
    // placeholder that at least distinguishes job types instead of
    // conflating four of the five into one code; flag for verification
    // against TimesJobs' real API docs before this integration goes live.
    jobtype: normalizeJobType(job.job_type, TIMESJOBS_JOB_TYPE_MAP),
    minexp: timesJobsExperience.min,
    maxexp: timesJobsExperience.max,
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

const TIMESJOBS_JOB_TYPE_MAP = {
  full_time: 1,
  part_time: 2,
  contract: 3,
  internship: 4,
  freelance: 3,
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
      employment_type: normalizeJobType(job.job_type, ZIP_JOB_TYPE_MAP),
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

const ZIP_JOB_TYPE_MAP = {
  full_time: 'full_time',
  part_time: 'part_time',
  contract: 'contractor',
  internship: 'intern',
  // Not covered by the old switch (silently fell through to 'full_time')
  freelance: 'contractor',
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
    job_type: normalizeJobType(job.job_type, WELLFOUND_JOB_TYPE_MAP),
    location_type: job.remote ? 'remote' : 'onsite',
    location: job.location,
    skills: Array.isArray(job.skills) ? job.skills : [],
    min_years_experience: job.min_experience ?? 0,
    apply_url: job.apply_url ?? `${APP_URL}/jobs/${job.id}`,
    // Previously hardcoded currency: 'INR' regardless of the job's actual
    // salary_currency — every non-INR job silently mislabeled its own
    // compensation figures to Wellfound.
    compensation: job.salary_min
      ? { min: job.salary_min, max: job.salary_max ?? job.salary_min, currency: normalizeCurrencyCode(job.salary_currency) }
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

const WELLFOUND_JOB_TYPE_MAP = {
  full_time: 'full_time',
  part_time: 'part_time',
  contract: 'contract',
  internship: 'internship',
  // Not covered by the old switch (silently fell through to 'full_time')
  freelance: 'contract',
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
