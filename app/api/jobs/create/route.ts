import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pingGoogleIndexing } from '@/lib/google-indexing'
import { sendJobPostedEmail } from '@/lib/emails'
import { jobSlug } from '@/types'
import type { PostJobFormValues } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get company and check quota
  const { data: company, error: companyErr } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (companyErr || !company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  if (!company.plan_active) return NextResponse.json({ error: 'Plan not active' }, { status: 403 })
  if (company.jobs_used >= company.jobs_quota) {
    return NextResponse.json({ error: 'Job quota exceeded' }, { status: 403 })
  }

  const form: PostJobFormValues = await req.json()

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 60)

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      company_id: company.id,
      title: form.title.trim(),
      description: form.description,
      location: form.location.trim(),
      job_type: form.job_type,
      remote: form.remote,
      skills: form.skills,
      domain: form.domain ?? [],
      min_experience: form.min_experience ?? 0,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      salary_currency: form.salary_currency,
      apply_url: form.apply_method === 'url' ? form.apply_url : null,
      apply_email: form.apply_method === 'email' ? form.apply_email : null,
      status: 'active',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error || !job) {
    console.error('[jobs/create]', error)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  // Increment jobs_used
  await supabase
    .from('companies')
    .update({ jobs_used: company.jobs_used + 1 })
    .eq('id', company.id)

  // Fire and forget: Google Indexing + confirmation email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'
  const slug = jobSlug(job)
  pingGoogleIndexing(`${appUrl}/jobs/${slug}`)
  sendJobPostedEmail(company, job).catch(console.error)

  return NextResponse.json({ success: true, job })
}
