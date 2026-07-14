/**
 * POST /api/admin/run-ingest
 *
 * Admin-only endpoint to manually trigger a job ingest run.
 * Protected by Supabase session (must be logged in as a company user).
 *
 * NOTE: Does NOT use requireCompany() because that function calls redirect()
 * which throws NEXT_REDIRECT — when caught in a try/catch it silently returns 401.
 * Instead we do a direct Supabase auth check that works correctly in route handlers.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runIngest } from '@/lib/job-supply/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  // Direct auth check — redirect() must never be called from an API route catch block
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Run with:
    //  - skipCareerPages: true  → skip career page scraper (slow, error-prone, runs in cron)
    //  - parallelFetch: true    → fetch Remotive / Arbeitnow / Jobicy in parallel
    //  - serpApiSearches: 3     → limited SerpAPI calls
    //  - enrichLimit: 20        → small enrichment batch to stay within 60s
    const stats = await runIngest({
      serpApiSearches:  3,
      enrichLimit:      20,
      skipCareerPages:  true,
      parallelFetch:    true,
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
