/**
 * Lever public job board API
 *
 * URL patterns:
 *   https://jobs.lever.co/{slug}
 *   https://{company}.com/careers → may embed lever
 *
 * API: GET https://api.lever.co/v0/postings/{slug}?mode=json
 */

import type { RawJobListing } from '../../dedup'

interface LeverPosting {
  id: string
  text: string          // job title
  categories: {
    commitment?: string  // 'Full-time', 'Part-time', etc.
    department?: string
    location?: string
    team?: string
  }
  description: string   // HTML
  descriptionPlain: string
  lists: Array<{ text: string; content: string }>
  additional: string
  additionalPlain: string
  hostedUrl: string
  applyUrl: string
  createdAt: number     // unix ms
  updatedAt?: number
}

export async function fetchLeverJobs(slug: string): Promise<RawJobListing[]> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`Lever slug not found: ${slug}`)
    throw new Error(`Lever API error ${res.status} for slug: ${slug}`)
  }

  const postings: LeverPosting[] = await res.json()

  return postings.map((p): RawJobListing => {
    const description = p.descriptionPlain || stripHtml(p.description || '')
    const extras = [
      ...p.lists.map(l => `${l.text}: ${stripHtml(l.content)}`),
      p.additionalPlain || stripHtml(p.additional || ''),
    ].filter(Boolean).join('\n')
    const fullDesc = [description, extras].filter(Boolean).join('\n\n').slice(0, 5000)

    return {
      title:           p.text,
      company_name:    slug,
      location:        p.categories.location || 'Remote',
      description:     fullDesc || null,
      url:             p.hostedUrl,
      salary_min:      null,
      salary_max:      null,
      salary_currency: 'USD',
      remote:          isRemote(p.categories.location),
      posted_at:       p.createdAt ? new Date(p.createdAt).toISOString() : null,
      source:          'career_page',
      external_id:     `lv-${p.id}`,
      skills:          [],
    }
  })
}

/** Extract Lever slug from known URL patterns */
export function detectLeverSlug(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'jobs.lever.co') {
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
