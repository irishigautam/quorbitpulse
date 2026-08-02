/**
 * POST /api/candidate/apply
 *
 * c6 — One-click apply with Quorbit profile.
 * Creates a candidate_applications record linking the candidate to the job.
 * The recruiter sees this in their pipeline as a new "sourced" candidate.
 *
 * Body: { job_id: string, company_id?: string }
 */

import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logEvent } from '@/lib/analytics/log-event'
import { computeMatchScore } from '@/lib/scoring/engine'
import { sendApplicationReceivedEmail, sendNewApplicationEmail } from '@/lib/ats/notifications'
import { notifyAttempt } from '@/lib/notifications/log'
import { toSafeAiErrorMessage } from '@/lib/ai/client'
import type { CandidateFingerprint } from '@/lib/scoring/fingerprint'
import type { CandidateProfile } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'

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
      .maybeSingle()

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
      .maybeSingle()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    // Fast-path rejection only, using a snapshot read - not the source of
    // truth. submit_candidate_application() below re-checks this atomically
    // (with a row lock) immediately before writing, which is what actually
    // closes the "job closed/deleted mid-application" race.
    if (job.status !== 'active') {
      return NextResponse.json({ error: 'Job is no longer active' }, { status: 400 })
    }

    const company_id = job.company_id ?? bodyCompanyId
    if (!company_id) {
      return NextResponse.json({ error: 'Could not determine company' }, { status: 400 })
    }

    // ID-04 (launch checklist) — logged before the duplicate-check/insert so
    // a failure or duplicate further down still shows up as a "started but
    // did not complete" gap between this and the candidate_applied event
    // below, instead of that drop-off being invisible entirely.
    await logEvent({
      eventType: 'apply_started',
      companyId: company_id,
      entityId: job_id,
      metadata: { candidate_id: candidate.id },
    })

    // Score using the same weighted engine the recruiter's manual
    // score-batch/blend-scores routes use (lib/scoring/engine.ts), instead
    // of the previous ad hoc inline heuristic — the two scoring paths
    // disagreeing was flagged as a real inconsistency during the P0-023
    // code trace. The candidate's fingerprint (skills/domain/seniority/
    // years_experience) was already extracted once at resume-upload time,
    // so no extra AI call is needed here — just reuse it.
    const { data: candidateData } = await supabase
      .from('candidate_profiles')
      .select('skills, domain, years_experience, seniority, resume_file_path')
      .eq('id', candidate.id)
      .maybeSingle()

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

    // The 4 writes below (application insert, imported_candidates
    // upsert, pipeline assignment upsert, status sync) used to be
    // sequential, un-transacted Supabase calls: if any write after the
    // first failed, the candidate had a "successful" application that the
    // recruiter would never see, with no rollback. submit_candidate_application
    // (see supabase/migrations/026_transactional_candidate_apply.sql) performs all of them as one atomic Postgres
    // transaction, and re-checks the job is still active (with a row lock)
    // immediately before writing - closing the window where a recruiter
    // could close/delete the job between our first check above and the
    // actual insert.
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('submit_candidate_application', {
        p_candidate_id: candidate.id,
        p_job_id: job_id,
        p_company_id: company_id,
        p_match_score: matchScore,
        p_score_breakdown: scoreBreakdown,
        p_candidate_email: candidate.email,
        p_candidate_full_name: candidate.full_name,
        p_candidate_current_title: candidate.current_title ?? null,
        p_candidate_current_company: candidate.current_company ?? null,
        p_candidate_location: candidate.location ?? null,
        p_candidate_linkedin_url: candidate.linkedin_url ?? null,
        p_candidate_skills: candidateData?.skills ?? [],
        p_candidate_domain: candidateData?.domain ?? [],
        p_candidate_seniority: candidateData?.seniority ?? null,
        p_candidate_years_experience: candidateData?.years_experience ?? null,
        p_candidate_resume_file_path: candidateData?.resume_file_path ?? null,
      })
      .single()

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }
    if (rpcResult?.job_inactive) {
      return NextResponse.json({ error: 'Job is no longer active' }, { status: 400 })
    }
    if (rpcResult?.duplicate) {
      return NextResponse.json({ error: 'Already applied to this job' }, { status: 409 })
    }

    const application = { id: rpcResult!.application_id as string }

    await logEvent({
      eventType: 'candidate_applied',
      companyId: company_id,
      entityId: application.id,
      metadata: { candidate_id: candidate.id, job_id, match_score: matchScore },
    })

    // CJ-05/CJ-07 + EJ-06 (launch checklist) — neither the candidate nor the
    // employer previously got any email signal that an application had just
    // happened; both had to notice inside the dashboard. Fire-and-forget via
    // notifyAttempt() so a delivery failure is logged (and now alerted, see
    // lib/notifications/log.ts) instead of silently vanishing, and never
    // blocks the response the candidate is waiting on.
    const { data: companyRow } = await supabase
      .from('companies')
      .select('name, careers_email')
      .eq('id', company_id)
      .maybeSingle()

    after(async () => {
      await Promise.allSettled([
        notifyAttempt({
          channel: 'email',
          template: 'application_received',
          companyId: company_id,
          recipient: candidate.email,
          metadata: { jobId: job_id, applicationId: application.id },
          send: () => sendApplicationReceivedEmail({
            candidateName: candidate.full_name,
            candidateEmail: candidate.email,
            jobTitle: job.title,
            companyName: companyRow?.name ?? 'the hiring team',
          }),
        }),
        notifyAttempt({
          channel: 'email',
          template: 'new_application',
          companyId: company_id,
          recipient: companyRow?.careers_email ?? null,
          metadata: { jobId: job_id, applicationId: application.id, candidateId: candidate.id },
          send: () => sendNewApplicationEmail({
            careersEmail: companyRow?.careers_email ?? '',
            candidateName: candidate.full_name,
            jobTitle: job.title,
            matchScore,
            dashboardUrl: `${APP_URL}/dashboard/candidates`,
          }),
        }),
      ])
    })

    return NextResponse.json({ application_id: application.id, match_score: matchScore })
  } catch (err: any) {
    return NextResponse.json(
      { error: toSafeAiErrorMessage(err, 'candidate-apply', 'Apply failed. Please try again shortly.') },
      { status: 500 },
    )
  }
}
