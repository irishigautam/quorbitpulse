import { requireCompany } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Job } from '@/types'
import { jobSlug } from '@/types'
import JobActionsClient from './JobActionsClient'

function daysLeft(expires: string) {
  const diff = new Date(expires).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function statusBadge(status: string, days: number) {
  if (status === 'expired') return { label: 'Expired', color: '#6B7280' }
  if (status === 'draft') return { label: 'Draft', color: '#D97706' }
  if (days <= 7) return { label: `Expires in ${days}d`, color: '#EF4444' }
  return { label: 'Active', color: '#16A34A' }
}

export default async function MyJobsPage({
  searchParams,
}: {
  searchParams: { posted?: string }
}) {
  const { company } = await requireCompany()
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('company_id', company.id)
    .order('posted_at', { ascending: false })

  const posted = (await searchParams).posted === '1'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          My Jobs
        </h1>
        <Link
          href="/dashboard/post"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + Post a job
        </Link>
      </div>

      {posted && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#DCFCE7', color: '#166534' }}>
          ✓ Job posted successfully and is now live.
        </div>
      )}

      {!jobs || jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-lg font-medium mb-2" style={{ fontFamily: 'var(--font-display)' }}>
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
        <div className="space-y-3">
          {jobs.map((job: Job) => {
            const days = daysLeft(job.expires_at)
            const badge = statusBadge(job.status, days)
            const slug = jobSlug(job)

            return (
              <div key={job.id} className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ background: badge.color }}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-gray-100">
                        {job.job_type.replace('_', '-')}
                      </span>
                    </div>
                    <h2 className="font-semibold text-base truncate">{job.title}</h2>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
                      {job.location}{job.remote ? ' · Remote OK' : ''}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{job.views.toLocaleString()} views</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Posted {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Expires {new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <a
                    href={`/jobs/${slug}`}
                    target="_blank"
                    className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                  >
                    View live ↗
                  </a>
                  <JobActionsClient jobId={job.id} status={job.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
