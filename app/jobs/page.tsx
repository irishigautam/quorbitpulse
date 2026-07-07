import { createClient } from '@/lib/supabase/server'
import JobCard from '@/components/JobCard'
import ExternalJobCard from '@/components/ExternalJobCard'
import JobFiltersClient from './JobFiltersClient'
import type { Job, Company } from '@/types'
import Link from 'next/link'
import type { Metadata } from 'next'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Browse Jobs',
  description: 'Find your next role. Browse jobs from companies actively hiring on JobPulse.',
}

interface SearchParams {
  q?: string
  location?: string
  type?: string
  remote?: string
  skills?: string
  since?: string
}

export default async function JobBoardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()

  // ── 1. Company-posted jobs ────────────────────────────────────────────────
  let companyQuery = supabase
    .from('jobs')
    .select('*, company:companies(*)')
    .eq('status', 'active')
    .order('posted_at', { ascending: false })

  if (params.q) companyQuery = companyQuery.textSearch('fts', params.q)
  if (params.location) companyQuery = companyQuery.ilike('location', `%${params.location}%`)
  if (params.type) companyQuery = companyQuery.eq('job_type', params.type)
  if (params.remote === 'true') companyQuery = companyQuery.eq('remote', true)
  if (params.skills) {
    const skills = params.skills.split(',').filter(Boolean)
    if (skills.length > 0) companyQuery = companyQuery.overlaps('skills', skills)
  }
  if (params.since === '7') {
    const d = new Date(); d.setDate(d.getDate() - 7)
    companyQuery = companyQuery.gte('posted_at', d.toISOString())
  } else if (params.since === '30') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    companyQuery = companyQuery.gte('posted_at', d.toISOString())
  }

  const { data: companyJobs } = await companyQuery.limit(50)

  // ── 2. Scraped external jobs ──────────────────────────────────────────────
  let externalQuery = supabase
    .from('job_listings')
    .select('id, title, company_name, location, remote, salary_min, salary_max, salary_currency, skills, posted_at, url, source')
    .order('posted_at', { ascending: false, nullsFirst: false })

  if (params.q) {
    externalQuery = externalQuery.or(
      `title.ilike.%${params.q}%,company_name.ilike.%${params.q}%`
    )
  }
  if (params.location) externalQuery = externalQuery.ilike('location', `%${params.location}%`)
  if (params.remote === 'true') externalQuery = externalQuery.eq('remote', true)
  if (params.skills) {
    const skills = params.skills.split(',').filter(Boolean)
    if (skills.length > 0) externalQuery = externalQuery.overlaps('skills', skills)
  }
  // Only show jobs posted within 60 days to keep listings fresh
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60)
  externalQuery = externalQuery.gte('posted_at', cutoff.toISOString())

  if (params.since === '7') {
    const d = new Date(); d.setDate(d.getDate() - 7)
    externalQuery = externalQuery.gte('posted_at', d.toISOString())
  } else if (params.since === '30') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    externalQuery = externalQuery.gte('posted_at', d.toISOString())
  }

  const { data: externalJobs } = await externalQuery.limit(100)

  const totalCount = (companyJobs?.length ?? 0) + (externalJobs?.length ?? 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
            JobPulse
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/api-docs" className="text-sm hover:opacity-75" style={{ color: 'var(--muted)' }}>
              API
            </Link>
            <Link
              href="/onboarding/signup"
              className="text-sm px-4 py-1.5 rounded-lg font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              Post a job
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Open Jobs
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {totalCount} positions available · No account required to apply
          </p>
        </div>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Filters sidebar */}
          <aside className="lg:w-64 shrink-0">
            <JobFiltersClient initialParams={params} />
          </aside>

          {/* Job grid */}
          <main className="flex-1">
            {totalCount === 0 ? (
              <div className="bg-white rounded-2xl border p-12 text-center">
                <p className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  No jobs found
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company-posted jobs first */}
                {(companyJobs ?? []).map(job => (
                  <JobCard key={job.id} job={job as Job & { company: Company }} />
                ))}
                {/* External scraped jobs */}
                {(externalJobs ?? []).map(job => (
                  <ExternalJobCard key={`ext_${job.id}`} job={job as any} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="text-center py-6 text-xs border-t mt-8" style={{ color: 'var(--muted)' }}>
        Powered by{' '}
        <a href="https://quorbit.com" target="_blank" rel="noopener noreferrer" className="underline">
          Quorbit
        </a>
        {' · '}
        <Link href="/api-docs">Free API</Link>
        {' · '}
        <a href="/api/feed" target="_blank">RSS</a>
      </footer>
    </div>
  )
}
