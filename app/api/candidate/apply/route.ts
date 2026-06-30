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
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await requireCandidate()
    const supabase = createServiceClient()

    const { job_id, company_id: bodyCompanyId } = await req.json()

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    // Fetch job to get company_id and verify it's active
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('id, title, company_id, status')
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

    // Calculate a quick match score using candidate's fingerprint
    const { data: candidateData } = await supabase
      .from('candidate_profiles')
      .select('skills, domain, years_experience, seniority')
      .eq('id', candidate.id)
      .single()

    const candidateSkills = new Set((candidateData?.skills ?? []).map((s: string) => s.toLowerCase()))
    const candidateDomain = new Set((candidateData?.domain ?? []).map((d: string) => d.toLowerCase()))
    const jobSkills = (job as any).skills ?? []
    const jobDomain = (job as any).domain ?? []

    const skillMatch = jobSkills.length
      ? jobSkills.filter((s: string) => candidateSkills.has(s.toLowerCase())).length / jobSkills.length
      : 0.5
    const domainMatch = jobDomain.length
      ? jobDomain.filter((d: string) => candidateDomain.has(d.toLowerCase())).length / jobDomain.length
      : 0.5

    const matchScore = Math.round((skillMatch * 0.6 + domainMatch * 0.4) * 100)

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
          tags: ['direct-apply'],
        }, { onConflict: 'candidate_id,job_id' })
    }

    return NextResponse.json({ application_id: application.id, match_score: matchScore })
  } catch (err: any) {
    console.error('apply error:', err)
    return NextResponse.json({ error: err.message ?? 'Apply failed' }, { status: 500 })
  }
}
