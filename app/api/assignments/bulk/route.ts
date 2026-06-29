/**
 * POST /api/assignments/bulk
 *
 * ats4 — Bulk actions on candidate pipeline assignments.
 *
 * Body:
 * {
 *   assignment_ids: string[]          // max 100
 *   action: 'stage' | 'tag_add' | 'tag_remove' | 'reject'
 *   stage?: PipelineStage             // for action=stage
 *   tags?: string[]                   // for action=tag_add / tag_remove
 * }
 *
 * Returns: { updated: number, failed: number }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_STAGES = ['sourced', 'screened', 'interview', 'offer', 'hired', 'rejected']

export async function POST(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    const body = await req.json()
    const { assignment_ids, action, stage, tags } = body

    if (!Array.isArray(assignment_ids) || assignment_ids.length === 0) {
      return NextResponse.json({ error: 'assignment_ids must be a non-empty array' }, { status: 400 })
    }
    if (assignment_ids.length > 100) {
      return NextResponse.json({ error: 'Max 100 assignments per bulk action' }, { status: 400 })
    }

    // Verify all assignments belong to this company
    const { data: assignments, error: fetchErr } = await supabase
      .from('candidate_job_assignments')
      .select('id, tags, pipeline_stage')
      .in('id', assignment_ids)
      .eq('company_id', company.id)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const validIds = new Set((assignments ?? []).map(a => a.id))
    const ids = assignment_ids.filter(id => validIds.has(id))

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid assignments found' }, { status: 404 })
    }

    let updated = 0
    let failed = 0

    if (action === 'stage' || action === 'reject') {
      const targetStage = action === 'reject' ? 'rejected' : stage
      if (!VALID_STAGES.includes(targetStage)) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
      }

      const { error } = await supabase
        .from('candidate_job_assignments')
        .update({ pipeline_stage: targetStage, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('company_id', company.id)

      if (error) { failed = ids.length }
      else { updated = ids.length }

    } else if (action === 'tag_add' || action === 'tag_remove') {
      if (!Array.isArray(tags) || tags.length === 0) {
        return NextResponse.json({ error: 'tags required for tag actions' }, { status: 400 })
      }
      const cleanTags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean)

      // Process each assignment individually (tags are arrays requiring merge logic)
      for (const a of assignments ?? []) {
        const current: string[] = a.tags ?? []
        const next = action === 'tag_add'
          ? Array.from(new Set([...current, ...cleanTags]))
          : current.filter(t => !cleanTags.includes(t))

        const { error } = await supabase
          .from('candidate_job_assignments')
          .update({ tags: next, updated_at: new Date().toISOString() })
          .eq('id', a.id)
          .eq('company_id', company.id)

        if (error) failed++
        else updated++
      }

    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ updated, failed, total: ids.length })
  } catch (err) {
    console.error('bulk action error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
