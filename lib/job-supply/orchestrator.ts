/**
 * Job supply orchestrator — pulls from all sources, deduplicates, enriches, upserts.
 *
 * Sources:
 *   - Adzuna India (ADZUNA_APP_ID + ADZUNA_APP_KEY)
 *   - Google Jobs via SerpAPI (SERPAPI_KEY)
 *   - Remotive (free, no key)
 *   - Arbeitnow (free, no key)
 *   - Jobicy (free, no key)
 *   - Career page scraper (career_page_sources table)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdzunaJobs } from './adzuna'
import { fetchAllGoogleJobs } from './serpapi'
import { fetchRemotiveJobs } from './remotive'
import { fetchArbeitnowJobs } from './arbeitnow'
import { fetchJobicyJobs } from './jobicy'
import { scrapeCareerPage } from './career-scraper'
import { enrichJob } from './enrichment'
import { prepareForUpsert, computeDedupHash } from './dedup'
import type { RawJobListing } from './dedup'
import type { AdzunaJob } from './adzuna'

export interface IngestStats {
  fetched:  number
  new:      number
  updated:  number
  skipped:  number
  enriched: number
  errors:   number
  sources:  Record<string, number>
}

// ── Adzuna → RawJobListing ─────────────────────────────────────────────────

function normaliseAdzuna(job: AdzunaJob): RawJobListing {
  return {
    title:        job.title,
    company_name: job.company.display_name,
    location:     job.location.display_name,
    description:  job.description?.slice(0, 5000) ?? null,
    url:          job.redirect_url,
    salary_min:   job.salary_min ? Math.round(job.salary_min) : null,
    salary_max:   job.salary_max ? Math.round(job.salary_max) : null,
    salary_currency: 'INR',
    remote:       job.location.display_name.toLowerCase().includes('remote'),
    posted_at:    job.created ?? null,
    source:       'adzuna',
    external_id:  job.id,
  }
}

// ── Fetch from all sources ─────────────────────────────────────────────────

async function fetchFromAllSources(
  opts: { serpApiSearches?: number; skipCareerPages?: boolean; parallelFetch?: boolean } = {}
): Promise<{ jobs: RawJobListing[]; sources: Record<string, number> }> {
  const sources: Record<string, number> = {}
  const allJobs: RawJobListing[] = []

  // 1. Adzuna India — major India tech hubs
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    const adzunaQueries = [
      { what: 'software engineer', where: 'Bangalore' },
      { what: 'data scientist',    where: 'Bangalore' },
      { what: 'software engineer', where: 'Mumbai' },
      { what: 'product manager',   where: 'Delhi' },
      { what: 'devops engineer',   where: 'Hyderabad' },
      { what: 'fresher developer', where: 'India' },
    ]
    let adzunaCount = 0
    for (const q of adzunaQueries) {
      try {
        const jobs = await fetchAdzunaJobs({ ...q, max_days_old: 30, results_per_page: 50 })
        const normalised = jobs.map(normaliseAdzuna)
        allJobs.push(...normalised)
        adzunaCount += normalised.length
      } catch (err) {
        console.error('Adzuna fetch error:', err)
      }
      await delay(300)
    }
    sources['adzuna'] = adzunaCount
  } else {
    console.log('Adzuna: skipped (no API keys)')
  }

  // 2. Google Jobs via SerpAPI
  if (process.env.SERPAPI_KEY) {
    try {
      const serpJobs = await fetchAllGoogleJobs(opts.serpApiSearches ?? 15)
      allJobs.push(...serpJobs)
      sources['serpapi'] = serpJobs.length
    } catch (err) {
      console.error('SerpAPI error:', err)
      sources['serpapi'] = 0
    }
  } else {
    console.log('SerpAPI: skipped (no SERPAPI_KEY)')
  }

  // 3-5. Free job APIs — run in parallel when parallelFetch=true (saves ~20s)
  if (opts.parallelFetch) {
    console.log('Free APIs: fetching Remotive + Arbeitnow + Jobicy in parallel...')
    const [remotiveJobs, arbeitnowJobs, jobicyJobs] = await Promise.allSettled([
      fetchRemotiveJobs(),
      fetchArbeitnowJobs(2),   // 2 pages is enough for a quick run
      fetchJobicyJobs(),
    ])

    if (remotiveJobs.status === 'fulfilled') {
      allJobs.push(...remotiveJobs.value)
      sources['remotive'] = remotiveJobs.value.length
    } else {
      console.error('Remotive error:', remotiveJobs.reason)
      sources['remotive'] = 0
    }

    if (arbeitnowJobs.status === 'fulfilled') {
      allJobs.push(...arbeitnowJobs.value)
      sources['arbeitnow'] = arbeitnowJobs.value.length
    } else {
      console.error('Arbeitnow error:', arbeitnowJobs.reason)
      sources['arbeitnow'] = 0
    }

    if (jobicyJobs.status === 'fulfilled') {
      allJobs.push(...jobicyJobs.value)
      sources['jobicy'] = jobicyJobs.value.length
    } else {
      console.error('Jobicy error:', jobicyJobs.reason)
      sources['jobicy'] = 0
    }
  } else {
    // Sequential (default — used by cron)
    // 3. Remotive (free)
    try {
      const remotiveJobs = await fetchRemotiveJobs()
      allJobs.push(...remotiveJobs)
      sources['remotive'] = remotiveJobs.length
    } catch (err) {
      console.error('Remotive error:', err)
      sources['remotive'] = 0
    }

    // 4. Arbeitnow (free)
    try {
      const arbeitnowJobs = await fetchArbeitnowJobs()
      allJobs.push(...arbeitnowJobs)
      sources['arbeitnow'] = arbeitnowJobs.length
    } catch (err) {
      console.error('Arbeitnow error:', err)
      sources['arbeitnow'] = 0
    }

    // 5. Jobicy (free)
    try {
      const jobicyJobs = await fetchJobicyJobs()
      allJobs.push(...jobicyJobs)
      sources['jobicy'] = jobicyJobs.length
    } catch (err) {
      console.error('Jobicy error:', err)
      sources['jobicy'] = 0
    }
  }

  // 6. Career page scraper (company-specific career pages)
  //    Skipped in admin quick-trigger (skipCareerPages=true) — too slow for a 60s limit.
  //    Always runs in the daily cron.
  if (!opts.skipCareerPages) {
    try {
      const careerJobs = await fetchFromCareerPages()
      allJobs.push(...careerJobs.jobs)
      sources['career_page'] = careerJobs.jobs.length
    } catch (err) {
      console.error('Career page scraper error:', err)
      sources['career_page'] = 0
    }
  } else {
    console.log('Career pages: skipped (skipCareerPages=true)')
  }

  return { jobs: allJobs, sources }
}

// ── Career page scraper ────────────────────────────────────────────────────

async function fetchFromCareerPages(): Promise<{ jobs: RawJobListing[] }> {
  const supabase = createServiceClient()

  const { data: sources, error } = await supabase
    .from('career_page_sources')
    .select('id, company_name, career_url, ats_type, ats_slug')
    .eq('active', true)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(20)  // Process up to 20 sources per cron run to stay within time limit

  if (error || !sources?.length) return { jobs: [] }

  const allJobs: RawJobListing[] = []

  for (const source of sources) {
    try {
      const result = await scrapeCareerPage(
        source.career_url,
        source.company_name,
        {
          knownAtsType: source.ats_type as any,
          knownAtsSlug: source.ats_slug,
        }
      )

      allJobs.push(...result.jobs)

      // Update source stats + detected ATS type
      await supabase
        .from('career_page_sources')
        .update({
          last_scraped_at: new Date().toISOString(),
          last_jobs_found: result.jobs.length,
          total_jobs_ingested: supabase.rpc ? undefined : undefined,  // handled by trigger
          ats_type: result.ats_type,
          ats_slug: result.ats_slug,
          last_error: result.error ?? null,
          error_count: result.error ? (source as any).error_count + 1 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', source.id)

      await delay(500)  // be polite to servers
    } catch (err) {
      console.error(`Career page error for ${source.company_name}:`, err)
      await supabase
        .from('career_page_sources')
        .update({
          last_scraped_at: new Date().toISOString(),
          last_error: (err as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', source.id)
    }
  }

  console.log(`Career pages: ${allJobs.length} jobs from ${sources.length} sources`)
  return { jobs: allJobs }
}

// ── Deduplicate within the current batch ──────────────────────────────────

function deduplicateBatch(jobs: RawJobListing[]): RawJobListing[] {
  const seen = new Set<string>()
  return jobs.filter(job => {
    const hash = computeDedupHash(job.title, job.company_name, job.location)
    if (seen.has(hash)) return false
    seen.add(hash)
    return true
  })
}

// ── Upsert to Supabase ─────────────────────────────────────────────────────

async function upsertJobs(jobs: RawJobListing[]): Promise<{ new: number; updated: number; errors: number }> {
  const supabase = createServiceClient()
  const prepared = prepareForUpsert(jobs)

  let newCount = 0
  let updatedCount = 0
  let errorCount = 0

  // Upsert in chunks of 100
  const CHUNK = 100
  for (let i = 0; i < prepared.length; i += CHUNK) {
    const chunk = prepared.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('job_listings')
      .upsert(chunk, {
        onConflict: 'dedup_hash',
        ignoreDuplicates: false,
      })
      .select('id, created_at')

    if (error) {
      console.error('Upsert error:', error.message)
      errorCount += chunk.length
      continue
    }

    // Count new vs updated by checking created_at vs now
    const now = Date.now()
    for (const row of data ?? []) {
      const age = now - new Date(row.created_at).getTime()
      if (age < 30_000) newCount++
      else updatedCount++
    }
  }

  return { new: newCount, updated: updatedCount, errors: errorCount }
}

// ── Enrich unenriched listings ─────────────────────────────────────────────

async function enrichPendingListings(limit = 50): Promise<number> {
  const supabase = createServiceClient()

  // Fetch listings that haven't been enriched yet and have a description
  const { data: pending } = await supabase
    .from('job_listings')
    .select('id, title, description')
    .eq('enriched', false)
    .not('description', 'is', null)
    .limit(limit)

  if (!pending?.length) return 0

  let enriched = 0
  for (const listing of pending) {
    try {
      const fp = await enrichJob(listing.title, listing.description ?? '')
      await supabase
        .from('job_listings')
        .update({
          skills:         fp.skills,
          domain:         fp.domain,
          seniority:      fp.seniority,
          min_experience: fp.min_experience,
          remote:         fp.remote,
          enriched:       true,
        })
        .eq('id', listing.id)
      enriched++
      await delay(250)
    } catch (err) {
      console.error(`Enrich error for ${listing.id}:`, err)
    }
  }

  return enriched
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function runIngest(
  opts: {
    serpApiSearches?: number
    enrichLimit?: number
    skipCareerPages?: boolean
    parallelFetch?: boolean
  } = {}
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0, new: 0, updated: 0, skipped: 0, enriched: 0, errors: 0, sources: {}
  }

  console.log('Job ingest: starting...', JSON.stringify({ skipCareerPages: opts.skipCareerPages, parallelFetch: opts.parallelFetch }))

  // Step 1: Fetch from all sources
  const { jobs: raw, sources } = await fetchFromAllSources(opts)
  stats.fetched = raw.length
  stats.sources = sources
  console.log(`Fetched ${raw.length} total (${JSON.stringify(sources)})`)

  // Step 2: Dedup within batch
  const unique = deduplicateBatch(raw)
  stats.skipped = raw.length - unique.length
  console.log(`After dedup: ${unique.length} unique (${stats.skipped} duplicates in batch)`)

  // Step 3: Upsert to DB (Supabase handles cross-source dedup via dedup_hash UNIQUE constraint)
  const upsertResult = await upsertJobs(unique)
  stats.new     = upsertResult.new
  stats.updated = upsertResult.updated
  stats.errors  = upsertResult.errors
  console.log(`Upserted: ${stats.new} new, ${stats.updated} updated, ${stats.errors} errors`)

  // Step 4: Enrich unenriched listings (Haiku)
  stats.enriched = await enrichPendingListings(opts.enrichLimit ?? 50)
  console.log(`Enriched: ${stats.enriched} listings`)

  return stats
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
