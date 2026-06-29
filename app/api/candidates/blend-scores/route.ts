/**
 * POST /api/candidates/blend-scores
 *
 * Recomputes blended_score for all candidates in the company that have
 * at least a match_score. For each candidate, looks up their best
 * completed chat readiness_score and blends:
 *   blended = round(match_score * 0.70 + readiness_score * 0.30)
 *
 * Body: { candidate_id?: string }  — omit to run for all candidates
 *
 * Returns: { updated: number, results: { id, name, blended_score }[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { computeBlendedScore } from '@/lib/scoring/blended'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    const body = await req.json().catch(() => ({}))
    const { candidate_id } = body

    // Fetch candidates with match_score
    let query = supabase
      .from('imported_candidates')
      .select('id, full_name, match_score')
      .eq('company_id', company.id)
      .not('match_score', 'is', null)

    if (candidate_id) {
      query = query.eq('id', candidate_id)
    }

    const { data: candidates, error: candError } = await query
    if (candError) return NextResponse.json({ error: candError.message }, { status: 500 })
    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ updated: 0, results: [] })
    }

    const candidateIds = candidates.map(c => c.id)

    // Fetch best completed readiness_score per candidate
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('candidate_id, readiness_score')
      .eq('company_id', company.id)
      .eq('status', 'completed')
      .not('readiness_score', 'is', null)
      .in('candidate_id', candidateIds)
      .order('readiness_score', { ascending: false })

    // Build map: candidate_id → best readiness_score
    const readinessMap: Record<string, number> = {}
    for (const s of sessions ?? []) {
      if (!(s.candidate_id in readinessMap)) {
        readinessMap[s.candidate_id] = s.readiness_score
      }
    }

    // Compute and persist blended scores
    const results: { id: string; name: string; blended_score: number | null }[] = []
    let updated = 0

    for (const c of candidates) {
      const readiness = readinessMap[c.id] ?? null
      const blended = computeBlendedScore(c.match_score, readiness)

      const { error: upErr } = await supabase
        .from('imported_candidates')
        .update({ blended_score: blended })
        .eq('id', c.id)
        .eq('company_id', company.id)

      if (!upErr) {
        updated++
        results.push({ id: c.id, name: c.full_name, blended_score: blended })
      }
    }

    return NextResponse.json({ updated, results })
  } catch (err) {
    console.error('blend-scores error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
