/**
 * Google Jobs via SerpAPI — free tier: 100 searches/month.
 * Searches for tech roles across India cities + remote.
 * Env: SERPAPI_KEY
 *
 * Budget: ~20 searches per daily cron run (5 cities × 4 domains).
 * That = 620 searches/month max — upgrade to $50/mo plan if needed.
 * At 100/month free: schedule every 5 days or limit to 3 searches/run.
 */

import type { RawJobListing } from './dedup'

const SERPAPI_BASE = 'https://serpapi.com/search.json'

export interface SerpApiJob {
  title: string
  company_name: string
  location: string
  description?: string
  job_highlights?: Array<{ title: string; items: string[] }>
  detected_extensions?: {
    posted_at?: string
    salary?: string
    work_from_home?: boolean
    schedule_type?: string
  }
  related_links?: Array<{ link: string }>
  apply_options?: Array<{ link: string }>
  job_id: string
}

export interface GoogleJobsParams {
  query: string         // e.g. "Software Engineer Bangalore"
  location?: string     // overrides location in query
  chips?: string        // e.g. "date_posted:month" for freshness
  start?: number        // pagination offset (0, 10, 20…)
}

/** Fetch Google Jobs results from SerpAPI */
export async function fetchGoogleJobs(params: GoogleJobsParams): Promise<SerpApiJob[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_KEY not set')

  const qs = new URLSearchParams({
    engine: 'google_jobs',
    q: params.query,
    api_key: key,
    hl: 'en',
    gl: 'in',                         // geo: India
    chips: params.chips ?? 'date_posted:week',
    ...(params.location ? { location: params.location } : {}),
    ...(params.start    ? { start: String(params.start) } : {}),
  })

  const res = await fetch(`${SERPAPI_BASE}?${qs}`, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SerpAPI error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return (data.jobs_results ?? []) as SerpApiJob[]
}

/** Normalise SerpAPI jobs → RawJobListing */
export function normaliseSerpApiJob(job: SerpApiJob): RawJobListing {
  const ext = job.detected_extensions ?? {}

  // Best-effort apply URL
  const url = job.apply_options?.[0]?.link
    ?? job.related_links?.[0]?.link
    ?? `https://www.google.com/search?q=${encodeURIComponent(job.title + ' ' + job.company_name)}`

  // Extract salary range if present (SerpAPI returns e.g. "₹8L–₹20L a year")
  let salaryMin: number | null = null
  let salaryMax: number | null = null
  if (ext.salary) {
    const nums = ext.salary.match(/[\d,.]+/g)?.map(n => parseFloat(n.replace(/,/g, '')))
    if (nums && nums.length >= 2) {
      salaryMin = Math.round(nums[0])
      salaryMax = Math.round(nums[1])
    }
  }

  // Build description from highlights if full text missing
  let description = job.description ?? ''
  if (!description && job.job_highlights?.length) {
    description = job.job_highlights
      .map(h => `${h.title}:\n${h.items.join('\n')}`)
      .join('\n\n')
  }

  return {
    title:          job.title,
    company_name:   job.company_name,
    location:       job.location,
    description:    description.slice(0, 5000) || null,
    url,
    salary_min:     salaryMin,
    salary_max:     salaryMax,
    salary_currency: 'INR',
    remote:         ext.work_from_home ?? job.location.toLowerCase().includes('remote'),
    posted_at:      null,     // SerpAPI gives relative times; skip
    source:         'serpapi',
    external_id:    job.job_id,
  }
}

// ── Search matrix ──────────────────────────────────────────────────────────

const INDIA_LOCATIONS = [
  'Bangalore, Karnataka, India',
  'Mumbai, Maharashtra, India',
  'Delhi, India',
  'Hyderabad, Telangana, India',
  'Pune, Maharashtra, India',
]

const TECH_QUERIES = [
  'Software Engineer',
  'Data Scientist machine learning',
  'DevOps Engineer cloud',
  'Product Manager tech startup',
]

const REMOTE_QUERIES = [
  'Remote Software Engineer India',
  'Remote Frontend Developer',
  'Remote Backend Developer',
]

const FRESHER_QUERIES = [
  'Software Engineer fresher 0 1 year experience India',
  'Junior Developer entry level India',
]

/**
 * Run the full Google Jobs ingestion — respects the 100/month free budget.
 * maxSearches caps the number of API calls (default 15 for daily cron).
 */
export async function fetchAllGoogleJobs(maxSearches = 15): Promise<RawJobListing[]> {
  const results: RawJobListing[] = []
  let searches = 0

  // India city × tech domain searches
  for (const location of INDIA_LOCATIONS) {
    for (const query of TECH_QUERIES) {
      if (searches >= maxSearches) break
      try {
        const jobs = await fetchGoogleJobs({ query, location, chips: 'date_posted:week' })
        results.push(...jobs.map(normaliseSerpApiJob))
        searches++
        await delay(500)
      } catch (err) {
        console.error(`SerpAPI: ${query} @ ${location} failed:`, err)
      }
    }
    if (searches >= maxSearches) break
  }

  // Remote queries (no location override)
  for (const query of REMOTE_QUERIES) {
    if (searches >= maxSearches) break
    try {
      const jobs = await fetchGoogleJobs({ query, chips: 'date_posted:week' })
      results.push(...jobs.map(j => ({ ...normaliseSerpApiJob(j), remote: true })))
      searches++
      await delay(500)
    } catch (err) {
      console.error(`SerpAPI remote: ${query} failed:`, err)
    }
  }

  // Fresher/entry-level searches
  for (const query of FRESHER_QUERIES) {
    if (searches >= maxSearches) break
    try {
      const jobs = await fetchGoogleJobs({ query, chips: 'date_posted:month' })
      results.push(...jobs.map(normaliseSerpApiJob))
      searches++
      await delay(500)
    } catch (err) {
      console.error(`SerpAPI fresher: ${query} failed:`, err)
    }
  }

  console.log(`SerpAPI: ${searches} searches → ${results.length} raw jobs`)
  return results
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
