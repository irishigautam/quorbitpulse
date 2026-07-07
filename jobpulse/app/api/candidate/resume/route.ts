/**
 * POST /api/candidate/resume
 *
 * c2 — Resume upload + parsing for candidates.
 * Accepts a PDF (multipart/form-data, field "resume"), parses it with Claude Haiku,
 * and stores the fingerprint on the candidate_profiles row.
 *
 * Max file size: 5MB.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { parseResume } from '@/lib/candidate/resume-parser'
import { scanFile } from '@/lib/security/virus-scan'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await requireCandidate()
    const supabase = createServiceClient()

    const formData = await req.formData()
    const file = formData.get('resume')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 })
    }

    const typedFile = file as File
    if (!typedFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    const arrayBuffer = await typedFile.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 413 })
    }

    const buffer = Buffer.from(arrayBuffer)

    // Virus scan (hash-check against VirusTotal — fails open when key absent)
    const scan = await scanFile(buffer)
    if (!scan.safe) {
      return NextResponse.json(
        { error: `File rejected: ${scan.reason}` },
        { status: 422 },
      )
    }

    // Parse resume with Claude Haiku
    const fingerprint = await parseResume(buffer)

    // Store extracted text representation (optional — skip heavy upload, store summary)
    const { error: updateErr } = await supabase
      .from('candidate_profiles')
      .update({
        skills: fingerprint.skills,
        domain: fingerprint.domain,
        seniority: fingerprint.seniority,
        years_experience: fingerprint.years_experience,
        fingerprint_summary: fingerprint.summary,
        current_title: fingerprint.current_title ?? candidate.current_title,
        current_company: fingerprint.current_company ?? candidate.current_company,
        location: fingerprint.location ?? candidate.location,
        resume_text: `${fingerprint.full_name ?? ''}\n${fingerprint.summary}`.trim(),
        resume_processed_at: new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ fingerprint })
  } catch (err: any) {
    console.error('resume parse error:', err)
    return NextResponse.json({ error: err.message ?? 'Parse failed' }, { status: 500 })
  }
}
