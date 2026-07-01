/**
 * Job supply orchestrator — pulls from all sources, deduplicates, enriches, upserts.
 *
 * Sources:
 *   - Adzuna India (ADZUNA_APP_ID + ADZUNA_APP_KEY)
 *   - Google Jobs via SerpAPI (SERPAPI_KEY)
 *   - Remotive (free, no key)
 *   - Arbeitnow (free, no key)
 *   - Jobicy (free, no key)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdzunaJobs } from './adzuna'
import { fetchAllGoogleJobs } from './serpapi'
import { fetchRemotiveJobs } from './remotive'
import { fetchArbeitnowJobs } from './arbeitnow'
import { fetchJobicyJobs } from './jobicy'
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
  opts: { serpApiSearches?: number } = {}
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

  return { jobs: allJobs, sources }
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
  opts: { serpApiSearches?: number; enrichLimit?: number } = {}
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0, new: 0, updated: 0, skipped: 0, enriched: 0, errors: 0, sources: {}
  }

  console.log('Job ingest: starting...')

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
