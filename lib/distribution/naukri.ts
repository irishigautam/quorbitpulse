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

import type { Job } from '@/types'
import type { Database } from '@/types/supabase'
import type { DistributionResult } from './indeed'

type Company = Database['public']['Tables']['companies']['Row']

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'
const NAUKRI_API = 'https://www.naukri.com/jobapi/v1'

export async function distributeToNaukri(
  job: Job,
  company: Company
): Promise<DistributionResult> {
  // Prefer company-level key, fall back to platform-level key
  const apiKey =
    (company as any).naukri_api_key ?? process.env.NAUKRI_API_KEY
  const clientId =
    (company as any).naukri_client_id ?? process.env.NAUKRI_CLIENT_ID

  if (!apiKey || !clientId) {
    return {
      status: 'skipped',
      error: 'Naukri API key not configured — visit Settings → Distribution.',
      distributed_at: new Date().toISOString(),
    }
  }

  const applyUrl = job.apply_url ?? `${APP_URL}/jobs/${job.id}`

  const payload = {
    title: job.title,
    description: job.description,
    location: [job.location],
    jobType: mapJobType(job.job_type),
    workFromHome: job.remote ? 1 : 0,
    minExperience: job.min_experience ?? 0,
    maxExperience: (job.min_experience ?? 0) + 5,
    minSalary: job.salary_min ?? undefined,
    maxSalary: job.salary_max ?? undefined,
    currency: job.salary_currency === '₹' ? 'INR' : job.salary_currency ?? 'INR',
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

function mapJobType(type: string | null): number {
  // Naukri job type codes
  switch (type) {
    case 'full_time': return 1
    case 'part_time': return 2
    case 'contract': return 3
    case 'internship': return 9
    case 'freelance': return 3
    default: return 1
  }
}
