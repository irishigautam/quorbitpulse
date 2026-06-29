/**
 * /dashboard/pipeline — Job selector for Kanban pipeline view
 */

import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, posted_at')
    .eq('company_id', company.id)
    .in('status', ['active', 'expired'])
    .order('posted_at', { ascending: false })

  // Count candidates per job in pipeline
  const jobIds = (jobs ?? []).map(j => j.id)
  const { data: counts } = await supabase
    .from('candidate_job_assignments')
    .select('job_id, pipeline_stage')
    .in('job_id', jobIds)
    .eq('company_id', company.id)

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.job_id] = (countMap[row.job_id] ?? 0) + 1
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Pipeline
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Drag candidates through stages — Sourced → Screened → Interview → Offer → Hired
        </p>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="font-semibold mb-2">No jobs yet</p>
          <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>Post a job to start building your pipeline.</p>
          <Link href="/dashboard/post"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}>
            Post a job →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map(job => (
            <Link key={job.id} href={`/dashboard/pipeline/${job.id}`}
              className="bg-white rounded-2xl border p-5 hover:border-blue-300 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate group-hover:text-blue-600 transition-colors">
                    {job.title}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    {job.status === 'active' ? '🟢 Active' : '⚪ Expired'} ·{' '}
                    {new Date(job.posted_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                    {countMap[job.id] ?? 0}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>candidates</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
