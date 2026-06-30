/**
 * POST /api/v1/match — Quorbit Public Matching API v1
 *
 * inf1 — Versioned, public match endpoint. Third-party HR tools can call this
 * to score a candidate profile against a job description.
 *
 * Authentication: Bearer token (API key from api_keys table).
 * Pricing signal: records a 'score' usage event per call (metered).
 *
 * Request body:
 * {
 *   candidate: {
 *     skills: string[]
 *     domain: string[]
 *     seniority?: string
 *     years_experience?: number
 *   }
 *   job: {
 *     title: string
 *     skills?: string[]
 *     domain?: string[]
 *     min_experience?: number
 *     description?: string   // optional — triggers Haiku enrichment if skills/domain not provided
 *   }
 * }
 *
 * Response:
 * {
 *   match_score: number       // 0–100
 *   breakdown: {
 *     skill_score: number
 *     domain_score: number
 *     experience_score: number
 *     seniority_score: number
 *   }
 *   api_version: "v1"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

// ---- API key auth ----
async function resolveApiKey(authHeader: string | null): Promise<{ company_id: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)
  const keyHash = createHash('sha256').update(key).digest('hex')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('api_keys')
    .select('company_id')
    .eq('key_hash', keyHash)
    .single()

  return data ?? null
}

// ---- Matching logic ----
function scoreMatch(candidate: any, job: any): {
  match_score: number
  breakdown: { skill_score: number; domain_score: number; experience_score: number; seniority_score: number }
} {
  const candidateSkills = new Set((candidate.skills ?? []).map((s: string) => s.toLowerCase()))
  const candidateDomain = new Set((candidate.domain ?? []).map((d: string) => d.toLowerCase()))
  const jobSkills  = (job.skills  ?? []).map((s: string) => s.toLowerCase())
  const jobDomain  = (job.domain  ?? []).map((d: string) => d.toLowerCase())

  const skillScore = jobSkills.length
    ? Math.round((jobSkills.filter((s: string) => candidateSkills.has(s)).length / jobSkills.length) * 100)
    : 50

  const domainScore = jobDomain.length
    ? Math.round((jobDomain.filter((d: string) => candidateDomain.has(d)).length / jobDomain.length) * 100)
    : 50

  const candidateYoe = candidate.years_experience ?? null
  const jobMinYoe    = job.min_experience ?? null
  const experienceScore = (candidateYoe !== null && jobMinYoe !== null)
    ? Math.max(0, Math.min(100, Math.round(100 - Math.abs(candidateYoe - jobMinYoe) * 10)))
    : 50

  const SENIORITY_RANK: Record<string, number> = {
    intern: 0, junior: 1, mid: 2, senior: 3, lead: 4, principal: 5
  }
  const candRank = SENIORITY_RANK[candidate.seniority ?? ''] ?? -1
  const jobRank  = SENIORITY_RANK[job.seniority ?? ''] ?? -1
  const seniorityScore = (candRank >= 0 && jobRank >= 0)
    ? Math.max(0, 100 - Math.abs(candRank - jobRank) * 25)
    : 50

  const match_score = Math.round(
    skillScore * 0.45 + domainScore * 0.30 + experienceScore * 0.15 + seniorityScore * 0.10
  )

  return { match_score, breakdown: { skill_score: skillScore, domain_score: domainScore, experience_score: experienceScore, seniority_score: seniorityScore } }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const keyData = await resolveApiKey(authHeader)

    if (!keyData) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = await req.json()
    const { candidate, job } = body

    if (!candidate || !job) {
      return NextResponse.json({ error: 'candidate and job fields are required' }, { status: 400 })
    }

    // Enrich job if description provided but no skills/domain
    let enrichedJob = { ...job }
    if (job.description && (!job.skills?.length || !job.domain?.length)) {
      try {
        const { enrichJob } = await import('@/lib/job-supply/enrichment')
        const fingerprint = await enrichJob(job.title ?? 'Role', job.description)
        enrichedJob = {
          ...enrichedJob,
          skills:         enrichedJob.skills?.length  ? enrichedJob.skills  : fingerprint.skills,
          domain:         enrichedJob.domain?.length  ? enrichedJob.domain  : fingerprint.domain,
          min_experience: enrichedJob.min_experience  ?? fingerprint.min_experience,
          seniority:      enrichedJob.seniority       ?? fingerprint.seniority,
        }
      } catch {
        // proceed without enrichment
      }
    }

    const result = scoreMatch(candidate, enrichedJob)

    // Record usage event (metered)
    const supabase = createServiceClient()
    await supabase.from('usage_events').insert({
      company_id: keyData.company_id,
      event_type: 'score',
      metadata: { source: 'public_api_v1', job_title: job.title },
    })

    return NextResponse.json({ ...result, api_version: 'v1' })
  } catch (err: any) {
    console.error('v1 match error:', err)
    return NextResponse.json({ error: err.message ?? 'Match failed' }, { status: 500 })
  }
}

// GET — health + documentation pointer
export async function GET() {
  return NextResponse.json({
    api: 'Quorbit Matching API',
    version: 'v1',
    docs: 'https://quorbit.in/api-docs',
    endpoints: {
      'POST /api/v1/match': 'Score a candidate against a job',
    },
    auth: 'Bearer <api_key>',
  })
}
