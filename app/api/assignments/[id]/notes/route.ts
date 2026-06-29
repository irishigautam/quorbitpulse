/**
 * PATCH /api/assignments/[id]/notes  — ats5: recruiter notes
 * PATCH /api/assignments/[id]/tags   — ats2: candidate tags
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()
    const body = await req.json()

    if (typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 })
    }

    const { error } = await supabase
      .from('candidate_job_assignments')
      .update({ recruiter_notes: body.notes, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('company_id', company.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: params.id, notes: body.notes })
  } catch (err) {
    console.error('notes update error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
