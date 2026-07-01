/**
 * Greenhouse public job board API
 * Docs: https://developers.greenhouse.io/job-board.html
 *
 * URL patterns:
 *   https://boards.greenhouse.io/{slug}
 *   https://job-boards.greenhouse.io/{slug}
 *   https://{company}.com/careers → may embed greenhouse
 *
 * API: GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 */

import type { RawJobListing } from '../../dedup'

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  location: { name: string }
  absolute_url: string
  content?: string   // HTML job description (when ?content=true)
  departments?: Array<{ name: string }>
  offices?: Array<{ name: string }>
  metadata?: Array<{ id: number; name: string; value: string | null }>
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
  meta?: { total: number }
}

export async function fetchGreenhouseJobs(slug: string): Promise<RawJobListing[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Greenhouse slug not found: ${slug}`)
    throw new Error(`Greenhouse API error ${res.status} for slug: ${slug}`)
  }

  const data: GreenhouseResponse = await res.json()
  const jobs = data.jobs ?? []

  return jobs.map((job): RawJobListing => ({
    title:           job.title,
    company_name:    slug,   // caller will override with display name
    location:        job.location?.name || 'Remote',
    description:     job.content ? stripHtml(job.content).slice(0, 5000) : null,
    url:             job.absolute_url,
    salary_min:      null,
    salary_max:      null,
    salary_currency: 'USD',
    remote:          isRemote(job.location?.name),
    posted_at:       job.updated_at ?? null,
    source:          'career_page',
    external_id:     `gh-${job.id}`,
    skills:          [],
  }))
}

/** Extract Greenhouse slug from known URL patterns */
export function detectGreenhouseSlug(url: string): string | null {
  try {
    const u = new URL(url)
    // https://boards.greenhouse.io/slug  or  https://job-boards.greenhouse.io/slug
    if (u.hostname === 'boards.greenhouse.io' || u.hostname === 'job-boards.greenhouse.io') {
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
