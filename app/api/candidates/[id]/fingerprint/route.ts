/**
 * POST /api/candidates/[id]/fingerprint
 *
 * Triggers Claude Haiku fingerprint extraction for a single candidate.
 * Updates imported_candidates with ai_fingerprint, domain, seniority, skills,
 * years_experience, fingerprint_status, fingerprinted_at.
 *
 * Also triggers scoring against all assigned jobs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'
import { buildProfileText, extractFingerprint } from '@/lib/scoring/fingerprint'
import { computeMatchScore } from '@/lib/scoring/engine'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    // 1. Fetch the candidate (must belong to this company)
    const { data: candidate, error: fetchErr } = await supabase
      .from('imported_candidates')
      .select('*')
      .eq('id', id)
      .eq('company_id', company.id)
      .single()

    if (fetchErr || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // 2. Mark as processing
    await supabase
      .from('imported_candidates')
      .update({ fingerprint_status: 'processing' })
      .eq('id', id)

    // 3. Extract fingerprint via Claude Haiku
    const profileText = buildProfileText(candidate)
    let fingerprint
    try {
      fingerprint = await extractFingerprint(profileText)
    } catch (err) {
      await supabase
        .from('imported_candidates')
        .update({ fingerprint_status: 'failed' })
        .eq('id', id)
      console.error('Fingerprint extraction failed:', err)
      return NextResponse.json({ error: 'Fingerprint extraction failed' }, { status: 502 })
    }

    // 4. Save fingerprint fields
    const now = new Date().toISOString()
    await supabase
      .from('imported_candidates')
      .update({
        ai_fingerprint:    fingerprint,
        domain:            fingerprint.domain,
        seniority:         fingerprint.seniority,
        skills:            fingerprint.skills,
        years_experience:  fingerprint.years_experience,
        fingerprint_status: 'done',
        fingerprinted_at:  now,
        updated_at:        now,
      })
      .eq('id', id)

    // 5. Score against all assigned jobs
    const { data: assignments } = await supabase
      .from('candidate_job_assignments')
      .select('id, job_id, jobs(id, domain, skills, min_experience)')
      .eq('candidate_id', id)
      .eq('company_id', company.id)

    const scoredAssignments: Array<{ assignment_id: string; match_score: number }> = []

    if (assignments?.length) {
      for (const assignment of assignments) {
        const job = (assignment as any).jobs
        if (!job) continue

        const breakdown = computeMatchScore(fingerprint, job)

        await supabase
          .from('candidate_job_assignments')
          .update({
            match_score:     breakdown.total,
            score_breakdown: breakdown,
            scored_at:       now,
          })
          .eq('id', assignment.id)

        scoredAssignments.push({ assignment_id: assignment.id, match_score: breakdown.total })
      }

      // 6. Denormalise best score back to candidate row for pool dashboard sorting
      const bestScore = Math.max(...scoredAssignments.map(a => a.match_score))
      if (scoredAssignments.length > 0) {
        await supabase
          .from('imported_candidates')
          .update({
            match_score: bestScore,
            status: 'scored',
          })
          .eq('id', id)
      }
    }

    return NextResponse.json({
      success: true,
      fingerprint,
      assignments_scored: scoredAssignments.length,
      scores: scoredAssignments,
    })
  } catch (err) {
    console.error('Fingerprint route error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
