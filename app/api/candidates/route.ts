import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = await createClient()

    const { searchParams } = new URL(req.url)
    const job_id = searchParams.get('job_id')
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const search = searchParams.get('q')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const sort = searchParams.get('sort') ?? 'created_at'
    const sortAsc = searchParams.get('sort_dir') === 'asc'
    const allowedSorts = ['created_at', 'match_score', 'full_name']
    const safeSort = allowedSorts.includes(sort) ? sort : 'created_at'

    let query = supabase
      .from('imported_candidates')
      .select('*', { count: 'exact' })
      .eq('company_id', company.id)
      .order(safeSort, { ascending: sortAsc, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (source) query = query.eq('import_source', source)
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,current_title.ilike.%${search}%,current_company.ilike.%${search}%`
      )
    }

    // If filtering by job, join through assignments
    if (job_id) {
      const { data: assignmentIds } = await supabase
        .from('candidate_job_assignments')
        .select('candidate_id')
        .eq('job_id', job_id)
        .eq('company_id', company.id)
      const ids = (assignmentIds ?? []).map(a => a.candidate_id)
      if (ids.length === 0) {
        return NextResponse.json({ data: [], total: 0, limit, offset })
      }
      query = query.in('id', ids)
    }

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [], total: count ?? 0, limit, offset })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
