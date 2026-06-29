import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('jobs')
    .select('*, company:companies(*)')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, {
      status: 404,
      headers: { 'X-Powered-By': 'JobPulse by Quorbit' },
    })
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60',
      'X-Powered-By': 'JobPulse by Quorbit',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
