/**
 * Arbeitnow — free job board API. No API key required.
 * https://arbeitnow.com/api/job-board-api
 * Returns remote + EU jobs; good coverage of international tech roles open to India.
 */

import type { RawJobListing } from './dedup'

const ARBEITNOW_BASE = 'https://arbeitnow.com/api/job-board-api'

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]   // ['full-time', 'contract', ...]
  location: string
  created_at: number    // unix timestamp
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[]
  links: { next?: string }
}

export async function fetchArbeitnowJobs(maxPages = 3): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []
  let page = 1

  while (page <= maxPages) {
    try {
      const res = await fetch(`${ARBEITNOW_BASE}?page=${page}`, {
        headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
        cache: 'no-store',
      })
      if (!res.ok) break

      const data: ArbeitnowResponse = await res.json()
      if (!data.data?.length) break

      for (const job of data.data) {
        // Only keep remote jobs (most relevant for India candidates)
        if (!job.remote) continue

        results.push({
          title:           job.title,
          company_name:    job.company_name,
          location:        job.location || 'Remote',
          description:     stripHtml(job.description).slice(0, 5000),
          url:             job.url,
          salary_min:      null,
          salary_max:      null,
          salary_currency: 'USD',
          remote:          true,
          posted_at:       job.created_at ? new Date(job.created_at * 1000).toISOString() : null,
          source:          'arbeitnow',
          external_id:     job.slug,
          skills:          job.tags ?? [],
        })
      }

      if (!data.links?.next) break
      page++
      await delay(400)
    } catch (err) {
      console.error('Arbeitnow fetch error:', err)
      break
    }
  }

  console.log(`Arbeitnow: ${results.length} remote jobs`)
  return results
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
