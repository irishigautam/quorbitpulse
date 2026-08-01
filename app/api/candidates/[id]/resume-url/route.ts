/**
 * GET /api/candidates/[id]/resume-url
 *
 * EJ-04 (launch checklist) — recruiter-side resume access. Returns a
 * short-lived signed URL for a candidate's stored resume PDF, scoped to the
 * requesting company (imported_candidates.company_id must match) so one
 * company can never fetch another company's candidate's resume by guessing
 * an id. The 'resumes' bucket is private — this is the only way in.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { company } = await requireRole('recruiter')
  const supabase = createServiceClient()

  const { data: candidate, error } = await supabase
    .from('imported_candidates')
    .select('id, resume_file_path')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (error || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }
  if (!candidate.resume_file_path) {
    return NextResponse.json({ error: 'No resume on file for this candidate' }, { status: 404 })
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('resumes')
    .createSignedUrl(candidate.resume_file_path, 300) // 5 minutes

  if (signErr || !signed) {
    return NextResponse.json({ error: 'Could not generate resume link' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
