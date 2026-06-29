import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')
  const location = searchParams.get('location')
  const type = searchParams.get('type')
  const remote = searchParams.get('remote')
  const skills = searchParams.get('skills')
  const company_id = searchParams.get('company_id')
  const posted_after = searchParams.get('posted_after')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = createServiceClient()
  let query = supabase
    .from('jobs')
    .select('*, company:companies(*)', { count: 'exact' })
    .eq('status', 'active')
    .order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) query = query.textSearch('fts', q)
  if (location) query = query.ilike('location', `%${location}%`)
  if (type) query = query.eq('job_type', type)
  if (remote === 'true') query = query.eq('remote', true)
  if (skills) {
    const skillArr = skills.split(',').filter(Boolean)
    if (skillArr.length > 0) query = query.overlaps('skills', skillArr)
  }
  if (company_id) query = query.eq('company_id', company_id)
  if (posted_after) query = query.gte('posted_at', posted_after)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, {
      status: 500,
      headers: cacheHeaders(),
    })
  }

  return NextResponse.json(
    { data, total: count ?? 0, limit, offset },
    { headers: cacheHeaders() }
  )
}

function cacheHeaders() {
  return {
    'Cache-Control': 'public, s-maxage=60',
    'X-Powered-By': 'JobPulse by Quorbit',
    'Access-Control-Allow-Origin': '*',
  }
}
