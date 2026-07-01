/**
 * Jobicy — free remote jobs API. No API key required.
 * https://jobicy.com/api/v2/remote-jobs
 * Focused on remote tech/design roles. Returns up to 50 results per call.
 */

import type { RawJobListing } from './dedup'

const JOBICY_BASE = 'https://jobicy.com/api/v2/remote-jobs'

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  jobIndustry: string[]   // e.g. ["Engineering", "Design"]
  jobType: string[]        // e.g. ["full-time"]
  jobGeo: string           // e.g. "Worldwide" | "USA Only"
  jobLevel: string         // e.g. "Senior" | "Mid" | "Junior"
  jobExcerpt: string
  jobDescription: string
  pubDate: string          // ISO datetime
  annualSalaryMin?: number
  annualSalaryMax?: number
  salaryCurrency?: string
}

interface JobicyResponse {
  jobs: JobicyJob[]
}

// Tag categories Jobicy supports — map to our domains
const JOBICY_TAGS = [
  'software-engineer',
  'backend',
  'frontend',
  'fullstack',
  'devops',
  'data-science',
  'machine-learning',
  'product-manager',
  'mobile',
]

export async function fetchJobicyJobs(): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []

  for (const tag of JOBICY_TAGS) {
    try {
      const qs = new URLSearchParams({
        count: '50',
        geo: 'worldwide',
        tag: tag,
      })

      const res = await fetch(`${JOBICY_BASE}?${qs}`, {
        headers: { 'User-Agent': 'QuorbitPulse/1.0 (job aggregator)' },
        cache: 'no-store',
      })

      if (!res.ok) {
        console.error(`Jobicy: tag=${tag} returned ${res.status}`)
        continue
      }

      const data: JobicyResponse = await res.json()
      const jobs = data.jobs ?? []

      for (const job of jobs) {
        // Accept worldwide and Asia-open listings
        const geo = (job.jobGeo ?? '').toLowerCase()
        const ok = !geo || geo.includes('worldwide') || geo.includes('asia')
          || geo.includes('india') || geo.includes('anywhere')
        if (!ok) continue

        const description = stripHtml(job.jobDescription || job.jobExcerpt || '')

        results.push({
          title:           job.jobTitle,
          company_name:    job.companyName,
          location:        job.jobGeo || 'Remote',
          description:     description.slice(0, 5000),
          url:             job.url,
          salary_min:      job.annualSalaryMin ?? null,
          salary_max:      job.annualSalaryMax ?? null,
          salary_currency: job.salaryCurrency ?? 'USD',
          remote:          true,
          posted_at:       job.pubDate ?? null,
          source:          'jobicy',
          external_id:     String(job.id),
          skills:          [],   // enrichment fills this in
        })
      }

      await delay(300)
    } catch (err) {
      console.error(`Jobicy fetch error (tag=${tag}):`, err)
    }
  }

  // Deduplicate by id within this batch (same job can appear in multiple tag searches)
  const seen = new Set<string>()
  const deduped = results.filter(j => {
    if (seen.has(j.external_id!)) return false
    seen.add(j.external_id!)
    return true
  })

  console.log(`Jobicy: ${deduped.length} unique remote jobs`)
  return deduped
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
