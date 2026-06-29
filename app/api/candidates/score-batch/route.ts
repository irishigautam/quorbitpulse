/**
 * POST /api/candidates/score-batch
 *
 * Triggers fingerprint extraction + scoring for all candidates assigned to a job.
 * Runs up to BATCH_CONCURRENCY extractions in parallel.
 *
 * Body: { job_id: string }
 *
 * Returns: { queued: number, results: Array<{ candidate_id, status, match_score? }> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'
import { buildProfileText, extractFingerprint } from '@/lib/scoring/fingerprint'
import { computeMatchScore } from '@/lib/scoring/engine'

export const dynamic = 'force-dynamic'

const BATCH_CONCURRENCY = 3  // parallel Haiku calls

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const body = await req.json()
    const { job_id } = body

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Fetch job
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, domain, skills, min_experience')
      .eq('id', job_id)
      .eq('company_id', company.id)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 2. Get all candidates assigned to this job
    const { data: assignments, error: assignErr } = await supabase
      .from('candidate_job_assignments')
      .select('id, candidate_id')
      .eq('job_id', job_id)
      .eq('company_id', company.id)

    if (assignErr || !assignments?.length) {
      return NextResponse.json({ queued: 0, results: [] })
    }

    // 3. Fetch candidate rows
    const candidateIds = assignments.map(a => a.candidate_id)
    const { data: candidates } = await supabase
      .from('imported_candidates')
      .select('*')
      .in('id', candidateIds)
      .eq('company_id', company.id)

    if (!candidates?.length) {
      return NextResponse.json({ queued: 0, results: [] })
    }

    // 4. Build assignment lookup
    const assignmentByCandidateId = Object.fromEntries(
      assignments.map(a => [a.candidate_id, a.id])
    )

    // 5. Process in batches
    const results: Array<{ candidate_id: string; status: string; match_score?: number }> = []
    const now = new Date().toISOString()

    for (let i = 0; i < candidates.length; i += BATCH_CONCURRENCY) {
      const chunk = candidates.slice(i, i + BATCH_CONCURRENCY)

      await Promise.all(chunk.map(async (candidate) => {
        try {
          // Mark processing
          await supabase
            .from('imported_candidates')
            .update({ fingerprint_status: 'processing' })
            .eq('id', candidate.id)

          // Extract fingerprint
          const profileText = buildProfileText(candidate)
          const fingerprint = await extractFingerprint(profileText)

          // Save fingerprint
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
            .eq('id', candidate.id)

          // Score against this job
          const breakdown = computeMatchScore(fingerprint, job)

          const assignmentId = assignmentByCandidateId[candidate.id]
          if (assignmentId) {
            await supabase
              .from('candidate_job_assignments')
              .update({
                match_score:     breakdown.total,
                score_breakdown: breakdown,
                scored_at:       now,
              })
              .eq('id', assignmentId)
          }

          // Update candidate with best score + status
          await supabase
            .from('imported_candidates')
            .update({
              match_score: breakdown.total,
              status: 'scored',
            })
            .eq('id', candidate.id)

          results.push({ candidate_id: candidate.id, status: 'done', match_score: breakdown.total })
        } catch (err) {
          console.error(`Failed to fingerprint candidate ${candidate.id}:`, err)
          await supabase
            .from('imported_candidates')
            .update({ fingerprint_status: 'failed' })
            .eq('id', candidate.id)
          results.push({ candidate_id: candidate.id, status: 'failed' })
        }
      }))
    }

    return NextResponse.json({
      queued: candidates.length,
      results,
    })
  } catch (err) {
    console.error('score-batch error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
