/**
 * GET /api/candidates/search?q=React+AND+senior+NOT+contractor
 *
 * ats3 — Boolean full-text search across candidate pool.
 *
 * Supports:
 *   - Simple terms:        "React TypeScript"   → AND by default
 *   - Explicit AND/OR/NOT: "React AND senior NOT contractor"
 *   - Quoted phrases:      "product manager"
 *   - Tag filter:          &tag=top-match
 *   - Stage filter:        &stage=interview  (searches assignments)
 *   - Score filter:        &min_score=60
 *
 * Translates query to Postgres tsquery and runs against search_vector.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Convert a plain-English boolean query to a Postgres tsquery string */
function toTsQuery(raw: string): string {
  // Normalize operators to lowercase for detection
  const q = raw.trim()

  // If already uses & | ! operators, pass through (advanced users)
  if (/[&|!]/.test(q)) return q

  // Parse AND / OR / NOT keywords (case-insensitive)
  // e.g. "React AND senior NOT contractor" → "React & senior & !contractor"
  const tokens = q.split(/\s+/)
  const parts: string[] = []
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.toUpperCase() === 'AND') { i++; continue }
    if (t.toUpperCase() === 'OR') {
      // Replace last & connector with |
      if (parts.length > 0) parts[parts.length - 1] = parts[parts.length - 1].replace(/\s*&\s*$/, '') + ' | '
      i++; continue
    }
    if (t.toUpperCase() === 'NOT') {
      i++
      if (i < tokens.length) {
        parts.push(`!${tokens[i]}`)
        i++
      }
      continue
    }
    // Remove special chars, wrap multi-word phrases
    const clean = t.replace(/[^a-zA-Z0-9_\-'"]/g, '')
    if (clean) parts.push(clean)
    i++
  }

  return parts.join(' & ')
}

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    const { searchParams } = new URL(req.url)
    const rawQuery = searchParams.get('q')?.trim() ?? ''
    const tagFilter = searchParams.get('tag')
    const minScore = searchParams.get('min_score') ? Number(searchParams.get('min_score')) : null
    const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
    const offset = Number(searchParams.get('offset') ?? '0')

    if (!rawQuery && !tagFilter) {
      return NextResponse.json({ results: [], total: 0, query: '' })
    }

    let query = supabase
      .from('imported_candidates')
      .select('id, full_name, email, current_title, current_company, location, skills, domain, seniority, match_score, blended_score, status, tags:candidate_job_assignments(tags)', { count: 'exact' })
      .eq('company_id', company.id)

    // Full-text search
    if (rawQuery) {
      const tsQuery = toTsQuery(rawQuery)
      if (tsQuery) {
        query = query.textSearch('search_vector', tsQuery, { type: 'websearch', config: 'english' })
      }
    }

    // Score filter
    if (minScore !== null) {
      query = query.gte('match_score', minScore)
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)
      .order('blended_score', { ascending: false, nullsFirst: false })

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Tag filter (post-query, since tags are on assignments not candidates)
    let results = data ?? []
    if (tagFilter) {
      results = results.filter((c: any) =>
        (c.tags ?? []).some((t: any) =>
          Array.isArray(t.tags) && t.tags.includes(tagFilter)
        )
      )
    }

    return NextResponse.json({
      results: results.map((c: any) => ({
        id: c.id,
        full_name: c.full_name,
        email: c.email,
        current_title: c.current_title,
        current_company: c.current_company,
        location: c.location,
        skills: c.skills ?? [],
        domain: c.domain ?? [],
        seniority: c.seniority,
        match_score: c.match_score,
        blended_score: c.blended_score,
        status: c.status,
      })),
      total: count ?? results.length,
      query: rawQuery,
      tsQuery: rawQuery ? toTsQuery(rawQuery) : '',
    })
  } catch (err) {
    console.error('search error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
