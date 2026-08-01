/**
 * GET /api/candidate/resume-url
 *
 * Candidate-side counterpart to /api/candidates/[id]/resume-url — lets a
 * candidate view/download their own stored resume from the private
 * 'resumes' bucket via a short-lived signed URL.
 */

import { NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { candidate } = await requireCandidate()
  const supabase = createServiceClient()

  if (!candidate.resume_file_path) {
    return NextResponse.json({ error: 'No resume uploaded yet' }, { status: 404 })
  }

  const { data: signed, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(candidate.resume_file_path, 300)

  if (error || !signed) {
    return NextResponse.json({ error: 'Could not generate resume link' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
