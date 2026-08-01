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
import { computeMatchScore } from '@/lib/scoring/engine'
import { LIMITS, rateLimitResponse } from '@/lib/security/rate-limit'
import { publicApiHeaders, corsPreflight } from '@/lib/api/cors'
import type { CandidateFingerprint } from '@/lib/scoring/fingerprint'

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
    .maybeSingle()

  return data ?? null
}

// ---- Matching logic ----
// Previously this route had its own hand-rolled scoring formula (skill/domain/
// experience/seniority weighted 45/30/15/10) that disagreed with the scoring
// used everywhere else in the product (lib/scoring/engine.ts, weighted
// 25/30/20/25 with domain-adjacency and seniority-gap logic). Two scoring
// engines for the same product meant a candidate could get a materially
// different score depending on which endpoint scored them. This route now
// calls the same shared engine as the dashboard/apply flow so there is one
// source of truth. Response field names are kept the same as before
// (skill_score/domain_score/experience_score/seniority_score/match_score) so
// existing public API consumers don't see a breaking shape change.
function scoreMatch(candidate: any, job: any) {
  const fingerprint: CandidateFingerprint = {
    domain: candidate.domain ?? [],
    seniority: candidate.seniority ?? null,
    skills: candidate.skills ?? [],
    years_experience: candidate.years_experience ?? null,
    summary: '',
  }
  const breakdown = computeMatchScore(fingerprint, {
    domain: job.domain ?? [],
    skills: job.skills ?? [],
    min_experience: job.min_experience ?? 0,
  })
  return {
    match_score: breakdown.total,
    breakdown: {
      skill_score: breakdown.skill_score,
      domain_score: breakdown.domain_score,
      experience_score: breakdown.yoe_score,
      seniority_score: breakdown.seniority_score,
    },
    // Additive fields (safe for existing consumers to ignore) - the same
    // evidence shown in the dashboard, so the public API gives the same
    // level of transparency the app does.
    evidence: {
      matched_skills: breakdown.matched_skills,
      missing_skills: breakdown.missing_skills,
      domain_match_type: breakdown.domain_match_type,
    },
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const keyData = await resolveApiKey(authHeader)

    if (!keyData) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401, headers: publicApiHeaders() },
      )
    }

    // This was the one metered, publicly reachable route with zero rate
    // limiting (score-batch, import, etc. all have one) - a single leaked or
    // guessed-adjacent key could otherwise be hammered without limit.
    const limit = LIMITS.publicMatch(keyData.company_id)
    if (!limit.allowed) return rateLimitResponse(limit)

    const body = await req.json()
    const { candidate, job } = body

    if (!candidate || !job) {
      return NextResponse.json(
        { error: 'candidate and job fields are required' },
        { status: 400, headers: publicApiHeaders() },
      )
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

    return NextResponse.json(
      { ...result, api_version: 'v1' },
      { headers: publicApiHeaders() },
    )
  } catch (err: any) {
    // Don't log the raw error object here - for this route it can carry the
    // caller's candidate/job payload (PII) via err.message on JSON parse
    // failures. Log a fixed message plus a stack for our own debugging only.
    console.error('v1 match error:', err?.message ?? 'unknown error')
    return NextResponse.json(
      { error: 'Match failed' },
      { status: 500, headers: publicApiHeaders() },
    )
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
  }, { headers: publicApiHeaders() })
}

export async function OPTIONS() {
  return corsPreflight()
}
