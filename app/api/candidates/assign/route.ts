import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCompany } from '@/lib/auth'

// POST /api/candidates/assign
// Body: { candidate_id, job_id }
export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = await createClient()

    const body = await req.json()
    const { candidate_id, job_id } = body

    if (!candidate_id || !job_id) {
      return NextResponse.json({ error: 'candidate_id and job_id are required' }, { status: 400 })
    }

    // Verify candidate belongs to this company
    const { data: candidate } = await supabase
      .from('imported_candidates')
      .select('id')
      .eq('id', candidate_id)
      .eq('company_id', company.id)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Verify job belongs to this company
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .eq('company_id', company.id)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Upsert assignment (no-op if already assigned)
    const { data: assignment, error } = await supabase
      .from('candidate_job_assignments')
      .upsert({
        candidate_id,
        job_id,
        company_id: company.id,
        pipeline_stage: 'sourced',
      }, { onConflict: 'candidate_id,job_id', ignoreDuplicates: true })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update candidate status if still 'new'
    await supabase
      .from('imported_candidates')
      .update({ status: 'in_pipeline' })
      .eq('id', candidate_id)
      .eq('status', 'new')

    return NextResponse.json({ assignment })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// PATCH /api/candidates/assign — update pipeline stage, notes, tags
export async function PATCH(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = await createClient()

    const body = await req.json()
    const { candidate_id, job_id, pipeline_stage, recruiter_notes, tags, starred } = body

    if (!candidate_id || !job_id) {
      return NextResponse.json({ error: 'candidate_id and job_id are required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (pipeline_stage !== undefined) updates.pipeline_stage = pipeline_stage
    if (recruiter_notes !== undefined) updates.recruiter_notes = recruiter_notes
    if (tags !== undefined) updates.tags = tags
    if (starred !== undefined) updates.starred = starred

    const { data, error } = await supabase
      .from('candidate_job_assignments')
      .update(updates)
      .eq('candidate_id', candidate_id)
      .eq('job_id', job_id)
      .eq('company_id', company.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assignment: data })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
