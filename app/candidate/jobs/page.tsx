/**
 * c5 — Job feed ranked by match score.
 * Candidate sees open roles sorted by their fingerprint match — not keyword search.
 */

import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'
import JobFeedClient from './JobFeedClient'

export const dynamic = 'force-dynamic'

export default async function CandidateJobFeedPage() {
  const { candidate } = await requireCandidate()
  const supabase = createServiceClient()

  // Fetch active jobs (from external job_listings + company-posted jobs)
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, location, job_type, remote, salary_min, salary_max, salary_currency, skills, domain, min_experience, posted_at, company:companies(id, name, logo_url)')
    .eq('status', 'active')
    .order('posted_at', { ascending: false })
    .limit(100)

  // Score each job against candidate's fingerprint
  const candidateSkillsSet = new Set((candidate.skills ?? []).map((s: string) => s.toLowerCase()))
  const candidateDomainSet = new Set((candidate.domain ?? []).map((d: string) => d.toLowerCase()))

  const scored = (jobs ?? []).map((job: any) => {
    const jobSkills: string[] = (job.skills ?? []).map((s: string) => s.toLowerCase())
    const jobDomain: string[] = (job.domain ?? []).map((d: string) => d.toLowerCase())

    const skillMatch = jobSkills.length
      ? jobSkills.filter((s: string) => candidateSkillsSet.has(s)).length / jobSkills.length
      : 0.5
    const domainMatch = jobDomain.length
      ? jobDomain.filter((d: string) => candidateDomainSet.has(d)).length / jobDomain.length
      : 0.5

    const expDiff = candidate.years_experience !== null && job.min_experience !== null
      ? Math.max(0, 1 - Math.abs(candidate.years_experience - job.min_experience) / 5)
      : 0.5

    const score = Math.round((skillMatch * 0.5 + domainMatch * 0.3 + expDiff * 0.2) * 100)
    return { ...job, match_score: score }
  })

  scored.sort((a: any, b: any) => b.match_score - a.match_score)

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Jobs for you</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Ranked by match with your profile · {scored.length} open roles
        </p>
      </div>
      <JobFeedClient jobs={scored} candidateId={candidate.id} />
    </div>
  )
}
