/**
 * GET /api/candidates/[id]/chat-sessions
 *
 * Returns all chat sessions for a candidate (most recent first).
 * Used by the recruiter dashboard to load transcripts and readiness scores.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { company } = await requireCompany()

    const supabase = createServiceClient()

    // Verify candidate belongs to this company
    const { data: candidate } = await supabase
      .from('imported_candidates')
      .select('id, full_name')
      .eq('id', id)
      .eq('company_id', company.id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('id, status, transcript, readiness_score, email_to, email_sent_at, created_at, updated_at, job_id, jobs(title)')
      .eq('candidate_id', id)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (err) {
    console.error('chat-sessions GET error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
