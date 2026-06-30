/**
 * GET /api/feeds/indeed
 *
 * Indeed-compatible XML job feed.
 * Also consumed by SimplyHired, Jora, Glassdoor, and other aggregators
 * that ingest the Indeed XML format.
 *
 * Register this URL in Indeed's Employer portal:
 * https://employers.indeed.com/p/post-jobs/xml-feed
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { jobToIndeedXml } from '@/lib/distribution/indeed'
import type { Job } from '@/types'
import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type Company = Database['public']['Tables']['companies']['Row']

export async function GET() {
  const supabase = createServiceClient()

  // Fetch all active jobs with their company
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*, companies(*)')
    .eq('status', 'active')
    .order('posted_at', { ascending: false })
    .limit(500)

  if (error) {
    return new NextResponse('Internal error', { status: 500 })
  }

  const jobEntries = (jobs ?? [])
    .map((row: any) => {
      const job: Job = row
      const company: Company = row.companies
      if (!company) return ''
      return jobToIndeedXml(job, company)
    })
    .filter(Boolean)
    .join('\n')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>Quorbit JobPulse</publisher>
  <publisherurl>${appUrl}</publisherurl>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${jobEntries}
</source>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900', // 15 min cache
    },
  })
}
