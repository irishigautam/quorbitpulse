/**
 * GET /api/cron/ingest-jobs
 *
 * Vercel cron job — runs daily at 2:00 AM UTC (7:30 AM IST).
 * Pulls jobs from all configured sources, deduplicates, enriches, and upserts.
 *
 * Protected by CRON_SECRET env var (set as Authorization: Bearer <CRON_SECRET>).
 * Vercel automatically sends this header for cron invocations.
 *
 * Can also be triggered manually:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" https://pulse.thequorbit.com/api/cron/ingest-jobs
 *
 * Optional query params:
 *   ?serp=10       Override SerpAPI search count (default 15)
 *   ?enrich=30     Override enrichment batch size (default 50)
 *   ?dry=true      Fetch + count only, skip DB writes
 */

import { NextRequest, NextResponse } from 'next/server'
import { runIngest } from '@/lib/job-supply/orchestrator'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 min — Vercel Pro limit; free plan max 60s

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '').trim()
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Parse options ──────────────────────────────────────────────────────────
  const url = req.nextUrl
  const serpSearches = Math.min(parseInt(url.searchParams.get('serp') ?? '15'), 50)
  const enrichLimit  = Math.min(parseInt(url.searchParams.get('enrich') ?? '50'), 100)
  const dryRun       = url.searchParams.get('dry') === 'true'

  const startedAt = Date.now()
  console.log(`[ingest-jobs] Starting: serp=${serpSearches} enrich=${enrichLimit} dry=${dryRun}`)

  try {
    if (dryRun) {
      return NextResponse.json({
        status: 'dry_run',
        message: 'Dry run — no DB writes. Remove ?dry=true to execute.',
        config: { serpSearches, enrichLimit },
      })
    }

    const stats = await runIngest({ serpApiSearches: serpSearches, enrichLimit })
    const duration = Math.round((Date.now() - startedAt) / 1000)

    console.log(`[ingest-jobs] Done in ${duration}s:`, stats)

    return NextResponse.json({
      status: 'ok',
      duration_seconds: duration,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ingest-jobs] Fatal error:', err)
    return NextResponse.json(
      { error: 'Ingest failed', message: (err as Error).message },
      { status: 500 }
    )
  }
}
