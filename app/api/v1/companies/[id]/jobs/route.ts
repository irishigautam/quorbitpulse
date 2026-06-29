import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, website, logo_url, description')
    .eq('id', id)
    .eq('plan_active', true)
    .single()

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('company_id', id)
    .eq('status', 'active')
    .order('posted_at', { ascending: false })

  return NextResponse.json(
    { company, jobs: jobs ?? [] },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'X-Powered-By': 'JobPulse by Quorbit',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
