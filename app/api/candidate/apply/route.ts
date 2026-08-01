/**
 * POST /api/candidate/apply
 *
 * c6 — One-click apply with Quorbit profile.
 * Creates a candidate_applications record linking the candidate to the job.
 * The recruiter sees this in their pipeline as a new "sourced" candidate.
 *
 * Body: { job_id: string, company_id?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/analytics/log-event'
import { computeMatchScore } from '@/lib/scoring/engine'
import type { CandidateFingerprint } from '@/lib/scoring/fingerprint'
import type { CandidateProfile } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Deliberately NOT using requireCandidate() here — it calls redirect(),
    // which only becomes a real HTTP redirect for Server Components/Actions.
    // Inside a Route Handler wrapped in try/catch, the thrown NEXT_REDIRECT
    // signal gets caught below and returned as a literal "NEXT_REDIRECT"
    // error string in the JSON body (confirmed live: the public job page
    // showed "NEXT_REDIRECT" as visible text instead of prompting sign-in).
    // A plain 401 lets the client redirect the browser itself instead.
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { data: candidateRow } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!candidateRow) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }
    const candidate = candidateRow as CandidateProfile

    const { job_id, company_id: bodyCompanyId } = await req.json()

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    // Fetch job to get company_id and verify it's active
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, company_id, status, domain, skills, min_experience')
      .eq('id', job_id)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.status !== 'active') {
      return NextResponse.json({ error: 'Job is no longer active' }, { status: 400 })
    }

    const company_id = job.company_id ?? bodyCompanyId
    if (!company_id) {
      return NextResponse.json({ error: 'Could not determine company' }, { status: 400 })
    }

    // Check for duplicate application
    const { data: existing } = await supabase
      .from('candidate_applications')
      .select('id')
      .eq('candidate_id', candidate.id)
      .eq('job_id', job_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already applied to this job' }, { status: 409 })
    }

    // Score using the same weighted engine the recruiter's manual
    // score-batch/blend-scores routes use (lib/scoring/engine.ts), instead
    // of the previous ad hoc inline heuristic — the two scoring paths
    // disagreeing was flagged as a real inconsistency during the P0-023
    // code trace. The candidate's fingerprint (skills/domain/seniority/
    // years_experience) was already extracted once at resume-upload time,
    // so no extra AI call is needed here — just reuse it.
    const { data: candidateData } = await supabase
      .from('candidate_profiles')
      .select('skills, domain, years_experience, seniority')
      .eq('id', candidate.id)
      .single()

    const fingerprint: CandidateFingerprint = {
      domain: candidateData?.domain ?? [],
      seniority: candidateData?.seniority ?? null,
      skills: candidateData?.skills ?? [],
      years_experience: candidateData?.years_experience ?? null,
      summary: '',
    }

    const scoreBreakdown = computeMatchScore(fingerprint, {
      domain: (job as any).domain ?? [],
      skills: (job as any).skills ?? [],
      min_experience: (job as any).min_experience ?? 0,
    })
    const matchScore = scoreBreakdown.total

    // Insert application
    const { data: application, error: appErr } = await supabase
      .from('candidate_applications')
      .insert({
        candidate_id: candidate.id,
        job_id,
        company_id,
        match_score: matchScore,
        status: 'pending',
        applied_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (appErr) {
      return NextResponse.json({ error: appErr.message }, { status: 500 })
    }

    await logEvent({
      eventType: 'candidate_applied',
      companyId: company_id,
      entityId: application.id,
      metadata: { candidate_id: candidate.id, job_id, match_score: matchScore },
    })

    // Also create an imported_candidates + assignment entry on the recruiter side
    // so the recruiter sees this application in their pipeline
    const { data: existingImported } = await supabase
      .from('imported_candidates')
      .select('id')
      .eq('email', candidate.email)
      .eq('company_id', company_id)
      .single()

    let importedCandidateId = existingImported?.id

    if (!importedCandidateId) {
      const { data: newImported } = await supabase
        .from('imported_candidates')
        .insert({
          company_id,
          full_name: candidate.full_name,
          email: candidate.email,
          current_title: candidate.current_title,
          current_company: candidate.current_company,
          location: candidate.location,
          linkedin_url: candidate.linkedin_url,
          import_source: 'direct_apply',
          skills: candidateData?.skills ?? [],
          domain: candidateData?.domain ?? [],
          seniority: candidateData?.seniority,
          years_experience: candidateData?.years_experience,
          status: 'new',
          fingerprint_status: 'done',
        })
        .select('id')
        .single()
      importedCandidateId = newImported?.id
    }

    if (importedCandidateId) {
      // Create pipeline assignment
      await supabase
        .from('candidate_job_assignments')
        .upsert({
          candidate_id: importedCandidateId,
          job_id,
          company_id,
          pipeline_stage: 'sourced',
          match_score: matchScore,
          score_breakdown: scoreBreakdown,
          scored_at: new Date().toISOString(),
          tags: ['direct-apply'],
        }, { onConflict: 'candidate_id,job_id' })

      // Keep imported_candidates.status in sync so this candidate shows as
      // already scored in the recruiter's candidate pool, not stuck at 'new'.
      await supabase
        .from('imported_candidates')
        .update({ match_score: matchScore, status: 'scored' })
        .eq('id', importedCandidateId)
    }

    return NextResponse.json({ application_id: application.id, match_score: matchScore })
  } catch (err: any) {
    console.error('apply error:', err)
    return NextResponse.json({ error: err.message ?? 'Apply failed' }, { status: 500 })
  }
}
