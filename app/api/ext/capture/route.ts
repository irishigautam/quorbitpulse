/**
 * POST /api/ext/capture
 *
 * imp1/imp2 — Chrome extension capture endpoint.
 * Receives candidate profile data from LinkedIn/Naukri content scripts
 * and imports into the company's candidate pool.
 *
 * Auth: Bearer API key + X-Quorbit-Company header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

async function resolveApiKey(req: NextRequest): Promise<{ company_id: string } | null> {
  const authHeader = req.headers.get('authorization')
  const companyId  = req.headers.get('x-quorbit-company')

  if (!authHeader?.startsWith('Bearer ') || !companyId) return null

  const key     = authHeader.slice(7)
  const keyHash = createHash('sha256').update(key).digest('hex')

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('api_keys')
    .select('company_id')
    .eq('key_hash', keyHash)
    .eq('company_id', companyId)
    .single()

  return data ?? null
}

export async function POST(req: NextRequest) {
  try {
    const keyData = await resolveApiKey(req)
    if (!keyData) {
      return NextResponse.json({ error: 'Unauthorized — invalid API key or company ID' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const profile = await req.json()

    if (!profile.full_name) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }

    const source = profile.source === 'naukri_ext' ? 'naukri_ext' : 'linkedin_ext'

    // Deduplicate by linkedin_url or email
    if (profile.linkedin_url || profile.email) {
      let dupQuery = supabase
        .from('imported_candidates')
        .select('id')
        .eq('company_id', keyData.company_id)

      if (profile.linkedin_url) dupQuery = dupQuery.eq('linkedin_url', profile.linkedin_url)
      else if (profile.email)   dupQuery = dupQuery.eq('email', profile.email)

      const { data: dup } = await dupQuery.single()
      if (dup) {
        return NextResponse.json({ duplicate: true, id: dup.id, message: 'Candidate already in pool' })
      }
    }

    const { data, error } = await supabase
      .from('imported_candidates')
      .insert({
        company_id:      keyData.company_id,
        full_name:       profile.full_name,
        email:           profile.email ?? null,
        linkedin_url:    profile.linkedin_url ?? (source === 'naukri_ext' ? null : profile.naukri_url),
        current_title:   profile.current_title ?? null,
        current_company: profile.current_company ?? null,
        location:        profile.location ?? null,
        skills:          profile.skills ?? [],
        domain:          profile.domain ?? [],
        years_experience: profile.years_experience ?? null,
        import_source:   source,
        status:          'new',
        fingerprint_status: (profile.skills?.length ?? 0) > 0 ? 'pending' : 'pending',
      })
      .select('id, full_name')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, candidate: data })
  } catch (err: any) {
    console.error('ext capture error:', err)
    return NextResponse.json({ error: err.message ?? 'Capture failed' }, { status: 500 })
  }
}
