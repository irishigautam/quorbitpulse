/**
 * /dashboard/pipeline/[jobId] — Kanban board for a specific job
 */

import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import KanbanClient from './KanbanClient'

export const dynamic = 'force-dynamic'

export default async function PipelineJobPage({ params }: { params: { jobId: string } }) {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  // Verify job belongs to company
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, status')
    .eq('id', params.jobId)
    .eq('company_id', company.id)
    .single()

  if (!job) notFound()

  // Fetch all assignments for this job with candidate data
  const { data: assignments } = await supabase
    .from('candidate_job_assignments')
    .select(`
      id,
      pipeline_stage,
      match_score,
      recruiter_notes,
      tags,
      starred,
      created_at,
      updated_at,
      candidate:imported_candidates(
        id, full_name, email, current_title, current_company,
        location, match_score, blended_score, status
      )
    `)
    .eq('job_id', params.jobId)
    .eq('company_id', company.id)
    .order('match_score', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/dashboard/pipeline" className="text-sm hover:underline" style={{ color: 'var(--muted)' }}>
          ← Pipeline
        </Link>
        <span style={{ color: 'var(--muted)' }}>/</span>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          {job.title}
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full ml-1"
          style={{ background: job.status === 'active' ? '#DCFCE7' : '#F3F4F6', color: job.status === 'active' ? '#14532D' : '#374151' }}>
          {job.status}
        </span>
      </div>

      <KanbanClient
        jobId={job.id}
        initialAssignments={(assignments ?? []) as any}
      />
    </div>
  )
}
