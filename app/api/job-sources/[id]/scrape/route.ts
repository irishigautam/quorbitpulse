/**
 * POST /api/job-sources/[id]/scrape
 * Manually trigger a scrape for a single career page source.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { scrapeCareerPage } from '@/lib/job-supply/career-scraper'
import { prepareForUpsert } from '@/lib/job-supply/dedup'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error: authErr } = await requireCompany()
  if (authErr) return authErr

  const supabase = createServiceClient()

  const { data: source, error: fetchErr } = await supabase
    .from('career_page_sources')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }

  const result = await scrapeCareerPage(
    source.career_url,
    source.company_name,
    { knownAtsType: source.ats_type, knownAtsSlug: source.ats_slug }
  )

  // Upsert jobs
  let upserted = 0
  if (result.jobs.length > 0) {
    const prepared = prepareForUpsert(result.jobs)
    const { error: upsertErr } = await supabase
      .from('job_listings')
      .upsert(prepared, { onConflict: 'dedup_hash', ignoreDuplicates: false })

    if (!upsertErr) upserted = prepared.length
  }

  // Update source stats
  await supabase
    .from('career_page_sources')
    .update({
      last_scraped_at: new Date().toISOString(),
      last_jobs_found: result.jobs.length,
      ats_type: result.ats_type,
      ats_slug: result.ats_slug,
      last_error: result.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  return NextResponse.json({
    ok: true,
    jobs_found: result.jobs.length,
    jobs_upserted: upserted,
    ats_type: result.ats_type,
    ats_slug: result.ats_slug,
    error: result.error,
  })
}
