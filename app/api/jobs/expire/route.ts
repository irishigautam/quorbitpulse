import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pingGoogleIndexing } from '@/lib/google-indexing'
import { jobSlug } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { job_id } = await req.json()

  // Verify ownership
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!company) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: job, error } = await supabase
    .from('jobs')
    .update({ status: 'expired' })
    .eq('id', job_id)
    .eq('company_id', company.id)
    .select()
    .single()

  if (error || !job) return NextResponse.json({ error: 'Failed to expire job' }, { status: 500 })

  // Notify Google to remove from index
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'
  pingGoogleIndexing(`${appUrl}/jobs/${jobSlug(job)}`, 'URL_DELETED')

  return NextResponse.json({ success: true })
}
