import { requireCompany } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import CandidatePoolClient from './CandidatePoolClient'

export const metadata: Metadata = { title: 'Candidates' }

export default async function CandidatesPage() {
  const { company } = await requireCompany()
  const supabase = await createClient()

  // Fetch summary stats
  const { count: total } = await supabase
    .from('imported_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)

  const { count: newCount } = await supabase
    .from('imported_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('status', 'new')

  const { count: inPipeline } = await supabase
    .from('imported_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('status', 'in_pipeline')

  // Fetch last import batch
  const { data: lastBatch } = await supabase
    .from('import_batches')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch initial page of candidates
  const { data: candidates } = await supabase
    .from('imported_candidates')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch active jobs for assign-to-job dropdown
  const { data: activeJobs } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .order('posted_at', { ascending: false })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Candidates
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Your imported candidate pool — scored and ranked per job.
          </p>
        </div>
        <Link
          href="/dashboard/candidates/import"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
          style={{ background: 'var(--accent)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          Import candidates
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total imported', value: total ?? 0, sub: 'all time' },
          { label: 'Unscored', value: newCount ?? 0, sub: 'awaiting AI scoring' },
          { label: 'In pipeline', value: inPipeline ?? 0, sub: 'assigned to jobs' },
          {
            label: 'Last import',
            value: lastBatch ? `+${lastBatch.inserted}` : '—',
            sub: lastBatch
              ? new Date(lastBatch.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
              : 'No imports yet',
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border p-5">
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* AI Scoring notice */}
      {(newCount ?? 0) > 0 && (
        <div className="mb-6 px-5 py-4 rounded-xl text-sm flex items-start gap-3"
          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" className="mt-0.5 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
          <div>
            <p className="font-medium" style={{ color: '#1D4ED8' }}>
              AI scoring coming in Phase 2
            </p>
            <p style={{ color: '#3B82F6' }}>
              {newCount} candidate{newCount !== 1 ? 's' : ''} will be automatically scored against your open jobs once the scoring engine is live.
            </p>
          </div>
        </div>
      )}

      {/* Candidate pool table — client component for search/filter/assign */}
      <CandidatePoolClient
        initialCandidates={candidates ?? []}
        activeJobs={activeJobs ?? []}
        total={total ?? 0}
      />
    </div>
  )
}
