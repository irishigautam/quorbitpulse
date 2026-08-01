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

    // CJ-03 (launch checklist) — scanFile() existed but was never wired into
    // any upload path; every resume was accepted unscanned. Fail closed: a
    // file VirusTotal actually flags is rejected outright. Fails OPEN on
    // missing API key / timeout / VT downtime (see virus-scan.ts) so this
    // can't turn into a launch-day outage of its own.
    const scanResult = await scanFile(buffer)
    if (!scanResult.safe) {
      return NextResponse.json({ error: scanResult.reason }, { status: 422 })
    }

    // Parse resume with Claude Haiku
    const fingerprint = await parseResume(buffer)

    // EJ-04 (launch checklist) — previously the raw PDF was discarded right
    // after parsing, so a recruiter had no way to actually open a candidate's
    // resume, only the AI-extracted fields. Store it in the private
    // 'resumes' bucket; recruiters/candidates only ever get a short-lived
    // signed URL (see /api/candidates/[id]/resume-url and
    // /api/candidate/resume-url), never a public path.
    const resumeFilePath = `${candidate.id}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('resumes')
      .upload(resumeFilePath, buffer, { contentType: 'application/pdf', upsert: true })

    if (uploadErr) {
      // Don't fail the whole upload over storage — the parsed fingerprint is
      // still valuable even if the raw file couldn't be saved this time.
      console.error('resume storage upload failed:', uploadErr)
    }

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
        resume_file_path: uploadErr ? candidate.resume_file_path ?? null : resumeFilePath,
        resume_processed_at: new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Keep the recruiter-visible copy (imported_candidates) in sync so a
    // resume uploaded/replaced after applying still resolves to the latest
    // file instead of a stale or missing one.
    if (!uploadErr) {
      await supabase
        .from('imported_candidates')
        .update({ resume_file_path: resumeFilePath })
        .eq('email', candidate.email)
    }

    return NextResponse.json({ fingerprint })
  } catch (err: any) {
    console.error('resume parse error:', err)
    return NextResponse.json({ error: err.message ?? 'Parse failed' }, { status: 500 })
  }
}
