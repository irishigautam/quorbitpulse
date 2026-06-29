import { requireCompany } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dashboard' }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: { welcome?: string } }) {
  const { company } = await requireCompany()
  const params = await searchParams
  const supabase = await createClient()

  // Fetch all jobs for this company
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, views, posted_at, expires_at, job_type')
    .eq('company_id', company.id)
    .order('posted_at', { ascending: false })

  const allJobs = jobs ?? []
  const activeJobs = allJobs.filter(j => j.status === 'active')
  const totalViews = allJobs.reduce((sum, j) => sum + (j.views ?? 0), 0)
  const quotaRemaining = company.jobs_quota - company.jobs_used
  const planExpiry = company.plan_expires_at
    ? new Date(company.plan_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A'

  return (
    <div>
      {params.welcome === '1' && (
        <div className="mb-6 px-5 py-4 rounded-xl text-sm font-medium" style={{ background: '#EFF6FF', borderLeft: '4px solid var(--accent)', color: 'var(--navy)' }}>
          🎉 <strong>Your account is active.</strong> You're ready to post your first job. Reach candidates on Google Jobs, AI assistants, and our open API — all from one posting.
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Dashboard
        </h1>
        {quotaRemaining > 0 && (
          <Link
            href="/dashboard/post"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            + Post a job
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Jobs posted"
          value={`${company.jobs_used} / ${company.jobs_quota}`}
          sub={`${quotaRemaining} remaining`}
        />
        <StatCard
          label="Active listings"
          value={activeJobs.length}
          sub={`of ${allJobs.length} total`}
        />
        <StatCard
          label="Total views"
          value={totalViews.toLocaleString()}
          sub="across all listings"
        />
        <StatCard
          label="Plan expires"
          value={planExpiry}
          sub={company.plan_active ? 'Annual plan active' : 'Plan inactive'}
        />
      </div>

      {/* Recent jobs */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Recent Listings
          </h2>
          <Link href="/dashboard/jobs" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
            View all →
          </Link>
        </div>

        {allJobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              No jobs posted yet
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              Post your first job and start reaching candidates everywhere.
            </p>
            <Link
              href="/dashboard/post"
              className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Post your first job →
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {allJobs.slice(0, 5).map(job => {
              const daysLeft = Math.max(0, Math.ceil(
                (new Date(job.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              ))
              return (
                <div key={job.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{job.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {job.status === 'active' ? `${daysLeft}d remaining` : 'Expired'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{job.views.toLocaleString()}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>views</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quota warning */}
      {quotaRemaining === 0 && (
        <div className="mt-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
          You've used all {company.jobs_quota} job postings. Expire an existing listing or contact us to discuss additional quota.
        </div>
      )}
    </div>
  )
}
