import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = createServiceClient()

  // Get companies with job count
  const { data, count, error } = await supabase
    .from('companies')
    .select('id, name, website, logo_url, description, created_at', { count: 'exact' })
    .eq('plan_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach job counts
  const companiesWithCount = await Promise.all(
    (data ?? []).map(async (company: Record<string, unknown>) => {
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'active')
      return { ...company, active_jobs: jobCount ?? 0 }
    })
  )

  return NextResponse.json(
    { data: companiesWithCount, total: count ?? 0, limit, offset },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Powered-By': 'JobPulse by Quorbit',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
