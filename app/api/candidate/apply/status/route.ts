/**
 * GET /api/candidate/apply/status?job_id=...
 *
 * QA-audit fix: the job detail page's ApplyButton always rendered
 * "Apply on Pulse ->" on load regardless of whether the visitor had already
 * applied - clicking it correctly detected a duplicate server-side (no
 * second application was ever created), but the button itself never
 * reflected that until after a click. This lightweight, read-only endpoint
 * lets the client check on mount whether the currently signed-in candidate
 * has already applied to a given job, without requiring the job page itself
 * to give up its ISR caching (revalidate = 60) to embed visitor-specific
 * state server-side.
 *
 * Returns { applied: false } for a signed-out visitor rather than an error -
 * "have you applied" is meaningless without a session, and the caller
 * doesn't need to distinguish that from "no, not yet".
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('job_id')
  if (!jobId) {
    return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
  }

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ applied: false })
  }

  const supabase = createServiceClient()
  const { data: candidate } = await supabase
    .from('candidate_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!candidate) {
    return NextResponse.json({ applied: false })
  }

  const { data: existing } = await supabase
    .from('candidate_applications')
    .select('id')
    .eq('candidate_id', candidate.id)
    .eq('job_id', jobId)
    .maybeSingle()

  return NextResponse.json({ applied: !!existing })
}
