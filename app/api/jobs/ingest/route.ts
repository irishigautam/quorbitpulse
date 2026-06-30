/**
 * POST /api/jobs/ingest
 *
 * s1–s4 — Job supply ingest pipeline.
 * Fetches jobs from Adzuna, enriches them with Claude Haiku, deduplicates, and stores in job_listings.
 *
 * Body: {
 *   source: 'adzuna' | 'schema_org'
 *   query?: { what?: string; where?: string; max_days_old?: number; limit?: number }
 *   urls?: string[]   // for schema_org source — list of URLs to parse
 * }
 *
 * Protected by X-Admin-Secret header (same as admin panel).
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdzunaJobs } from '@/lib/job-supply/adzuna'
import { enrichJobsBatch } from '@/lib/job-supply/enrichment'
import { prepareForUpsert, computeDedupHash } from '@/lib/job-supply/dedup'
import type { RawJobListing } from '@/lib/job-supply/dedup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const h = await headers()
  const secret = h.get('x-admin-secret') ?? req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { source = 'adzuna', query = {}, urls = [] } = body

  const supabase = createServiceClient()
  const rawJobs: RawJobListing[] = []

  if (source === 'adzuna') {
    const adzunaJobs = await fetchAdzunaJobs({
      what: query.what,
      where: query.where ?? 'India',
      max_days_old: query.max_days_old ?? 30,
      results_per_page: Math.min(Number(query.limit ?? 50), 100),
    })

    for (const j of adzunaJobs) {
      rawJobs.push({
        external_id:  j.id,
        source:       'adzuna',
        title:        j.title,
        company_name: j.company.display_name,
        location:     j.location.display_name,
        description:  j.description,
        url:          j.redirect_url,
        salary_min:   j.salary_min,
        salary_max:   j.salary_max,
        salary_currency: 'INR',
        remote:       j.location.display_name.toLowerCase().includes('remote'),
        posted_at:    j.created,
      })
    }
  } else if (source === 'schema_org') {
    const { parseJobPostingsFromHtml } = await import('@/lib/job-supply/schema-parser')
    for (const url of (urls as string[])) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Quorbitbot/1.0 (+https://quorbit.in)' } })
        const html = await res.text()
        const postings = parseJobPostingsFromHtml(html, url)
        for (const p of postings) {
          rawJobs.push({ ...p, source: 'schema_org' })
        }
      } catch {
        // skip failed URLs
      }
    }
  }

  if (rawJobs.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, total: 0 })
  }

  // Enrich with Claude Haiku (skills + domain)
  const toEnrich = rawJobs.filter(j => !j.skills?.length && j.description)
  if (toEnrich.length > 0) {
    const fingerprints = await enrichJobsBatch(
      toEnrich.map(j => ({ title: j.title, description: j.description ?? '' }))
    )
    toEnrich.forEach((j, i) => {
      j.skills       = fingerprints[i].skills
      j.domain       = fingerprints[i].domain
      j.min_experience = fingerprints[i].min_experience
      if (!j.remote) j.remote = fingerprints[i].remote
    })
  }

  // Prepare and upsert
  const prepared = prepareForUpsert(rawJobs)

  const { data, error } = await supabase
    .from('job_listings')
    .upsert(prepared, { onConflict: 'dedup_hash', ignoreDuplicates: false })
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    total: rawJobs.length,
    inserted: (data ?? []).length,
    source,
  })
}
