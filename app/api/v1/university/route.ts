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

export const dynamic = 'force-dynamic'

async function resolveApiKey(authHeader: string | null): Promise<{ company_id: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const key = authHeader.slice(7)
  const keyHash = createHash('sha256').update(key).digest('hex')
  const supabase = createServiceClient()
  const { data } = await supabase.from('api_keys').select('company_id').eq('key_hash', keyHash).single()
  return data ?? null
}

export async function GET(req: NextRequest) {
  const keyData = await resolveApiKey(req.headers.get('authorization'))
  if (!keyData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, location, job_type, remote, skills, domain, min_experience, salary_min, salary_max, salary_currency, posted_at, company:companies(name, website)')
    .eq('status', 'active')
    .lte('min_experience', 2)  // campus placement = entry level
    .order('posted_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ jobs: jobs ?? [], total: (jobs ?? []).length })
}

export async function POST(req: NextRequest) {
  const keyData = await resolveApiKey(req.headers.get('authorization'))
  if (!keyData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { candidates, university_name, batch_year } = await req.json()

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: 'candidates array required' }, { status: 400 })
  }
  if (candidates.length > 200) {
    return NextResponse.json({ error: 'Max 200 candidates per submission' }, { status: 400 })
  }

  let imported = 0, skipped = 0

  for (const c of candidates) {
    if (!c.full_name) continue

    // Skip duplicates by email
    if (c.email) {
      const { data: dup } = await supabase
        .from('imported_candidates')
        .select('id').eq('email', c.email).eq('company_id', keyData.company_id).single()
      if (dup) { skipped++; continue }
    }

    const { data } = await supabase
      .from('imported_candidates')
      .insert({
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
      })
      .select('id')
      .single()

    if (data) imported++
  }

  return NextResponse.json({ imported, skipped, total: candidates.length })
}
