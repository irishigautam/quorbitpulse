/**
 * Workable public job board API
 *
 * URL patterns:
 *   https://apply.workable.com/{slug}
 *   https://{slug}.workable.com
 *
 * API: GET https://apply.workable.com/api/v3/jobs?company={slug}&limit=100
 */

import type { RawJobListing } from '../../dedup'

interface WorkableJob {
  id: string
  title: string
  shortcode: string
  code?: string
  state: string           // 'published' | 'draft' | 'closed'
  department?: string
  location: {
    city?: string
    region?: string
    country?: string
    country_code?: string
    remote?: boolean
    workplace?: string   // 'remote' | 'hybrid' | 'onsite'
  }
  created_at: string
  published_on?: string
  employment_type?: string
  url: string
  description?: string
}

interface WorkableResponse {
  results: WorkableJob[]
  paging?: { next?: string }
}

export async function fetchWorkableJobs(slug: string): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []
  let nextUrl: string | null = `https://apply.workable.com/api/v3/jobs?company=${encodeURIComponent(slug)}&limit=100&status=published`

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error(`Workable company not found: ${slug}`)
      throw new Error(`Workable API error ${res.status} for slug: ${slug}`)
    }

    const data: WorkableResponse = await res.json()

    for (const job of data.results ?? []) {
      if (job.state !== 'published') continue

      const location = formatLocation(job.location)
      const remote = job.location?.remote === true || job.location?.workplace === 'remote'

      results.push({
        title:           job.title,
        company_name:    slug,
        location,
        description:     job.description ? stripHtml(job.description).slice(0, 5000) : null,
        url:             job.url,
        salary_min:      null,
        salary_max:      null,
        salary_currency: 'USD',
        remote,
        posted_at:       job.published_on || job.created_at || null,
        source:          'career_page',
        external_id:     `wk-${job.shortcode}`,
        skills:          [],
      })
    }

    nextUrl = data.paging?.next ?? null
  }

  return results
}

/** Extract Workable slug from known URL patterns */
export function detectWorkableSlug(url: string): string | null {
  try {
    const u = new URL(url)
    // https://apply.workable.com/slug
    if (u.hostname === 'apply.workable.com') {
      return u.pathname.split('/').filter(Boolean)[0] ?? null
    }
    // https://slug.workable.com
    if (u.hostname.endsWith('.workable.com')) {
      return u.hostname.split('.')[0] ?? null
    }
  } catch {}
  return null
}

function formatLocation(loc?: WorkableJob['location']): string {
  if (!loc) return 'Remote'
  if (loc.remote || loc.workplace === 'remote') return 'Remote'
  const parts = [loc.city, loc.region, loc.country].filter(Boolean)
  return parts.join(', ') || 'Unknown'
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}
