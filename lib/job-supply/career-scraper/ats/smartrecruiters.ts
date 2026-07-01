/**
 * SmartRecruiters public job board API
 *
 * URL patterns:
 *   https://careers.smartrecruiters.com/{slug}
 *
 * API: GET https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100&offset=0
 */

import type { RawJobListing } from '../../dedup'

interface SRJob {
  id: string
  name: string   // title
  location: {
    city?: string
    region?: string
    country?: string
    remote?: boolean
    remoteDetails?: { preference: string }
  }
  department?: { label: string }
  typeOfEmployment?: { label: string }
  experienceLevel?: { label: string }
  industry?: { label: string }
  datePosted?: string
  ref: string  // job page URL
}

interface SRResponse {
  content: SRJob[]
  totalFound: number
  limit: number
  offset: number
}

export async function fetchSmartRecruitersJobs(slug: string): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []
  let offset = 0
  const limit = 100

  while (true) {
    const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=${limit}&offset=${offset}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error(`SmartRecruiters company not found: ${slug}`)
      throw new Error(`SmartRecruiters API error ${res.status} for slug: ${slug}`)
    }

    const data: SRResponse = await res.json()
    const jobs = data.content ?? []

    for (const job of jobs) {
      const isRemoteFlag = job.location?.remote === true ||
        /remote|anywhere/i.test(job.location?.remoteDetails?.preference ?? '')

      const location = isRemoteFlag
        ? 'Remote'
        : [job.location?.city, job.location?.region, job.location?.country].filter(Boolean).join(', ') || 'Unknown'

      results.push({
        title:           job.name,
        company_name:    slug,
        location,
        description:     null,   // SR requires auth for full description
        url:             job.ref,
        salary_min:      null,
        salary_max:      null,
        salary_currency: 'USD',
        remote:          isRemoteFlag,
        posted_at:       job.datePosted ?? null,
        source:          'career_page',
        external_id:     `sr-${job.id}`,
        skills:          [],
      })
    }

    if (offset + limit >= data.totalFound || jobs.length === 0) break
    offset += limit
    await delay(300)
  }

  return results
}

/** Extract SmartRecruiters slug from known URL patterns */
export function detectSmartRecruitersSlug(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'careers.smartrecruiters.com') {
      return u.pathname.split('/').filter(Boolean)[0] ?? null
    }
  } catch {}
  return null
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
