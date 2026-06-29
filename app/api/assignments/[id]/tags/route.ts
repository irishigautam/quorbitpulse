/**
 * PATCH /api/assignments/[id]/tags — ats2: candidate tagging
 * Body: { tags: string[] }  — replaces the tag array entirely
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

    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    const tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)

    const { error } = await supabase
      .from('candidate_job_assignments')
      .update({ tags, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('company_id', company.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ id: params.id, tags })
  } catch (err) {
    console.error('tags update error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
