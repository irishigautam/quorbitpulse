/**
 * POST /api/jobs/optimize-jd
 * Employer-only. Rewrites/improves a draft job description via Claude Haiku.
 * Returns a suggestion only — never writes to the job; the form applies it
 * client-side if the employer accepts it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { optimizeJobDescription } from '@/lib/jobs/optimize-jd'
import { LIMITS } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { companyId } = await requireRole('recruiter')

  const rl = LIMITS.optimizeJd(companyId)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit reached for AI optimization. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
    )
  }

  const body = await req.json()
  const { title, description, job_type, location, remote, min_experience, skills } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  try {
    const optimized = await optimizeJobDescription({
      title,
      description: description ?? '',
      job_type: job_type ?? '',
      location: location ?? '',
      remote: !!remote,
      min_experience: min_experience ?? 0,
      skills: Array.isArray(skills) ? skills : [],
    })

    return NextResponse.json({ description: optimized })
  } catch (err) {
    console.error('[optimize-jd]', err)
    return NextResponse.json({ error: 'Failed to optimize description' }, { status: 500 })
  }
}
