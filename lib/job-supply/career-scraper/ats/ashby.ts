/**
 * Ashby public job board API
 *
 * URL patterns:
 *   https://jobs.ashbyhq.com/{slug}
 *
 * API: POST https://jobs.ashbyhq.com/api/non-user-facing/job-board/job-list
 *   body: { organizationHostedJobsPageName: slug }
 */

import type { RawJobListing } from '../../dedup'

interface AshbyJob {
  id: string
  title: string
  teamName?: string
  locationName?: string
  employmentType?: string  // 'FullTime' | 'PartTime' | 'Contract'
  isRemote?: boolean
  publishedDate?: string   // ISO date
  jobUrl?: string
  descriptionHtml?: string
  descriptionPlain?: string
}

interface AshbyResponse {
  jobs: AshbyJob[]
  organization?: { name: string }
}

export async function fetchAshbyJobs(slug: string): Promise<RawJobListing[]> {
  const res = await fetch(
    'https://jobs.ashbyhq.com/api/non-user-facing/job-board/job-list',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QuorbitPulse/1.0 (job aggregator)',
      },
      body: JSON.stringify({ organizationHostedJobsPageName: slug }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }
  )

  if (!res.ok) {
    throw new Error(`Ashby API error ${res.status} for slug: ${slug}`)
  }

  const data: AshbyResponse = await res.json()
  const jobs = data.jobs ?? []
  const companyName = data.organization?.name || slug

  return jobs.map((job): RawJobListing => ({
    title:           job.title,
    company_name:    companyName,
    location:        job.locationName || (job.isRemote ? 'Remote' : 'Unknown'),
    description:     job.descriptionPlain
      ? job.descriptionPlain.slice(0, 5000)
      : job.descriptionHtml
        ? stripHtml(job.descriptionHtml).slice(0, 5000)
        : null,
    url:             job.jobUrl || `https://jobs.ashbyhq.com/${slug}/${job.id}`,
    salary_min:      null,
    salary_max:      null,
    salary_currency: 'USD',
    remote:          job.isRemote ?? isRemote(job.locationName),
    posted_at:       job.publishedDate ?? null,
    source:          'career_page',
    external_id:     `ash-${job.id}`,
    skills:          [],
  }))
}

/** Extract Ashby slug from known URL patterns */
export function detectAshbySlug(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'jobs.ashbyhq.com') {
      return u.pathname.split('/').filter(Boolean)[0] ?? null
    }
  } catch {}
  return null
}

function isRemote(location?: string): boolean {
  if (!location) return false
  return /remote|anywhere|worldwide/i.test(location)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}
