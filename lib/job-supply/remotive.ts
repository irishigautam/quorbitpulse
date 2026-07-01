/**
 * Remotive — free remote jobs API. No API key required.
 * https://remotive.com/api/remote-jobs
 * Returns up to 150 jobs per category. Refreshed daily.
 */

import type { RawJobListing } from './dedup'

const REMOTIVE_BASE = 'https://remotive.com/api/remote-jobs'

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_url: string
  category: string
  tags: string[]
  job_type: string   // 'full_time' | 'contract' | 'part_time' | 'freelance'
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

const REMOTIVE_CATEGORIES = [
  'software-dev',
  'devops-sysadmin',
  'product',
  'data',
  'qa',
  'design',
]

export async function fetchRemotiveJobs(): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []

  for (const category of REMOTIVE_CATEGORIES) {
    try {
      const res = await fetch(`${REMOTIVE_BASE}?category=${category}&limit=50`, {
        headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
        cache: 'no-store',
      })
      if (!res.ok) {
        console.error(`Remotive: ${category} returned ${res.status}`)
        continue
      }

      const data = await res.json()
      const jobs: RemotiveJob[] = data.jobs ?? []

      for (const job of jobs) {
        // Filter: India-open or global open (skip "US only", "EU only" etc.)
        const loc = (job.candidate_required_location ?? '').toLowerCase()
        const indiaOk = !loc || loc.includes('worldwide') || loc.includes('india')
          || loc.includes('asia') || loc.includes('anywhere') || loc === ''

        if (!indiaOk) continue

        results.push({
          title:           job.title,
          company_name:    job.company_name,
          location:        job.candidate_required_location || 'Remote',
          description:     stripHtml(job.description).slice(0, 5000),
          url:             job.url,
          salary_min:      null,
          salary_max:      null,
          salary_currency: 'USD',
          remote:          true,
          posted_at:       job.publication_date ?? null,
          source:          'remotive',
          external_id:     String(job.id),
          skills:          job.tags ?? [],
        })
      }

      await delay(300)
    } catch (err) {
      console.error(`Remotive fetch error (${category}):`, err)
    }
  }

  console.log(`Remotive: ${results.length} India-eligible remote jobs`)
  return results
}

/** Strip HTML tags from Remotive's HTML description */
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
