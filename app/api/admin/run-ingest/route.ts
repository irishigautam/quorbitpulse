/**
 * POST /api/admin/run-ingest
 *
 * Admin-only endpoint to manually trigger a job ingest run.
 * Protected by Supabase session (must be logged in as a company admin).
 * Uses free sources only (no Adzuna/SerpAPI keys consumed when absent).
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { runIngest } from '@/lib/job-supply/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    await requireCompany()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run with conservative limits to stay within serverless timeout
    const stats = await runIngest({
      serpApiSearches: 5,   // limited SerpAPI calls to avoid burn
      enrichLimit:     20,  // small enrichment batch
    })
    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    console.error('[run-ingest] error:', err)
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
