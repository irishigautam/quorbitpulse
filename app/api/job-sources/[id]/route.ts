/**
 * PATCH /api/job-sources/[id]  — toggle active / update
 * DELETE /api/job-sources/[id] — remove source
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireCompany()

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('career_page_sources')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ source: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await requireCompany()

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('career_page_sources')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
