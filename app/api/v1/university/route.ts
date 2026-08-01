/**
 * inf3 — University Placement Office API.
 * Allows university career offices to submit student candidates for campus placements.
 *
 * POST /api/v1/university/candidates — bulk submit student profiles
 * GET  /api/v1/university/jobs       — list open jobs accepting campus candidates
 *
 * Auth: Bearer API key (same api_keys table, scoped to university_placement source)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { publicApiHeaders, corsPreflight } from '@/lib/api/cors'
import { LIMITS, rateLimitResponse } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

async function resolveApiKey(authHeader: string | null): Promise<{ company_id: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)
  const keyHash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceClient()
  // .single() throws on 0 rows, which turned an "invalid key" case into an
  // unhandled 500 instead of the intended 401 below. .maybeSingle() returns
  // null cleanly for the no-match case.
  const { data } = await supabase.from('api_keys').select('company_id').eq('key_hash', keyHash).maybeSingle()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const keyData = await resolveApiKey(req.headers.get('authorization'))
  if (!keyData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: publicApiHeaders() })

  const supabase = createServiceClient()
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, location, job_type, remote, skills, domain, min_experience, salary_min, salary_max, salary_currency, posted_at, company:companies(name, website)')
    .eq('status', 'active')
    .lte('min_experience', 2)  // campus placement = entry level
    .order('posted_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ jobs: jobs ?? [], total: (jobs ?? []).length }, { headers: publicApiHeaders() })
}

export async function POST(req: NextRequest) {
  const keyData = await resolveApiKey(req.headers.get('authorization'))
  if (!keyData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: publicApiHeaders() })

  const limit = LIMITS.candidateImport(keyData.company_id)
  if (!limit.allowed) return rateLimitResponse(limit)

  const supabase = createServiceClient()
  const { candidates, university_name, batch_year } = await req.json()

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: 'candidates array required' }, { status: 400, headers: publicApiHeaders() })
  }
  if (candidates.length > 200) {
    return NextResponse.json({ error: 'Max 200 candidates per submission' }, { status: 400, headers: publicApiHeaders() })
  }

  // Previously this looped per-candidate with a sequential dup-check SELECT
  // followed by a sequential INSERT for each row - up to 400 awaited DB round
  // trips for a 200-candidate batch. Batched into two queries total: one
  // SELECT for all existing emails, one bulk INSERT for the new rows.
  const withName = candidates.filter((c: any) => !!c.full_name)
  const emails = withName.map((c: any) => c.email).filter(Boolean)

  let existingEmails = new Set<string>()
  if (emails.length > 0) {
    const { data: dupRows } = await supabase
      .from('imported_candidates')
      .select('email')
      .eq('company_id', keyData.company_id)
      .in('email', emails)
    existingEmails = new Set((dupRows ?? []).map((r: { email: string }) => r.email))
  }

  const toInsert = withName.filter((c: any) => !c.email || !existingEmails.has(c.email))
  const skipped = candidates.length - toInsert.length

  let imported = 0
  if (toInsert.length > 0) {
    const rows = toInsert.map((c: any) => ({
      company_id:      keyData.company_id,
      full_name:       c.full_name,
      email:           c.email ?? null,
      current_title:   c.current_title ?? `${batch_year ?? ''} Graduate`.trim(),
      current_company: university_name ?? c.university ?? null,
      location:        c.location ?? null,
      skills:          c.skills ?? [],
      domain:          c.domain ?? [],
      seniority:       'intern',
      years_experience: 0,
      import_source:   'university_api',
      status:          'new',
      fingerprint_status: 'pending',
      notes:           `Campus placement · ${university_name ?? 'University'} · ${batch_year ?? ''}`,
    }))
    const { data: inserted } = await supabase.from('imported_candidates').insert(rows).select('id')
    imported = inserted?.length ?? 0
  }

  return NextResponse.json({ imported, skipped, total: candidates.length }, { headers: publicApiHeaders() })
}

export async function OPTIONS() {
  return corsPreflight()
}
