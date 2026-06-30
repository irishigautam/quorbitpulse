/**
 * POST /api/candidates/import/apollo
 *
 * imp3 — Apollo.io API integration.
 * Companies connect their Apollo API key and search for candidates to import.
 *
 * POST body:
 * {
 *   api_key: string             // Apollo API key (stored per-company)
 *   query: {
 *     title?: string
 *     location?: string
 *     skills?: string[]
 *     min_experience?: number
 *     domain?: string[]
 *     limit?: number           // max 100
 *   }
 * }
 *
 * GET — search with stored API key (if already configured)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const APOLLO_BASE = 'https://api.apollo.io/v1'

interface ApolloPersonResult {
  id: string
  name: string
  first_name: string
  last_name: string
  title: string | null
  organization?: { name: string | null }
  city: string | null
  state: string | null
  country: string | null
  email: string | null
  linkedin_url: string | null
  employment_history?: { title: string; end_date: string | null }[]
}

function buildLocation(p: ApolloPersonResult): string | null {
  return [p.city, p.state, p.country].filter(Boolean).join(', ') || null
}

function yearsExp(p: ApolloPersonResult): number | null {
  const history = p.employment_history ?? []
  if (history.length === 0) return null
  const sorted = history.slice().sort((a, b) => {
    const aEnd = a.end_date ? new Date(a.end_date).getTime() : Date.now()
    const bEnd = b.end_date ? new Date(b.end_date).getTime() : Date.now()
    return aEnd - bEnd
  })
  // Approximate: oldest start to now
  return Math.round(sorted.length * 1.5) // rough heuristic if no start dates
}

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    const body = await req.json()
    const { api_key, query = {} } = body

    if (!api_key) {
      return NextResponse.json({ error: 'Apollo API key required' }, { status: 400 })
    }

    const limit = Math.min(Number(query.limit ?? 25), 100)

    // Build Apollo people search payload
    const apolloPayload: Record<string, any> = {
      api_key,
      page: 1,
      per_page: limit,
      person_titles: query.title ? [query.title] : undefined,
      person_locations: query.location ? [query.location] : undefined,
      prospected_by_current_team: ['no'],
    }

    const apolloRes = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(apolloPayload),
    })

    if (!apolloRes.ok) {
      const err = await apolloRes.text()
      return NextResponse.json({ error: `Apollo API error: ${apolloRes.status}`, detail: err }, { status: 502 })
    }

    const apolloData = await apolloRes.json()
    const people: ApolloPersonResult[] = apolloData.people ?? []

    if (people.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, candidates: [] })
    }

    // Transform to imported_candidates rows
    const rows = people.map((p) => ({
      company_id: company.id,
      full_name: p.name,
      email: p.email,
      linkedin_url: p.linkedin_url,
      current_title: p.title,
      current_company: p.organization?.name ?? null,
      location: buildLocation(p),
      import_source: 'apollo' as const,
      skills: [],
      domain: [],
      years_experience: yearsExp(p),
      status: 'new' as const,
      fingerprint_status: 'pending' as const,
    }))

    // Upsert, skip duplicates by email+company
    let imported = 0
    let skipped = 0
    const inserted: any[] = []

    for (const row of rows) {
      if (row.email) {
        const { data: dup } = await supabase
          .from('imported_candidates')
          .select('id')
          .eq('email', row.email)
          .eq('company_id', company.id)
          .single()
        if (dup) { skipped++; continue }
      }

      const { data } = await supabase
        .from('imported_candidates')
        .insert(row)
        .select('id, full_name, email, current_title, current_company')
        .single()

      if (data) { imported++; inserted.push(data) }
    }

    return NextResponse.json({ imported, skipped, total: people.length, candidates: inserted })
  } catch (err: any) {
    console.error('apollo import error:', err)
    return NextResponse.json({ error: err.message ?? 'Import failed' }, { status: 500 })
  }
}
