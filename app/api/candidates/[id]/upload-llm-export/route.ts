/**
 * POST /api/candidates/[id]/upload-llm-export
 *
 * lc8 — Upload and process a candidate's LLM chat history export.
 *
 * Flow:
 *   1. Parse export JSON (ChatGPT or Claude format)
 *   2. Run privacy classifier — only work_relevant passes through (lc9)
 *   3. Extract work signals via Claude Haiku
 *   4. Merge signals into candidate fingerprint (skills, domain, years_experience)
 *   5. Persist to DB + record llm_export_processed_at
 *
 * Body: multipart/form-data with field `file` (JSON file)
 *   OR  application/json with field `export` (raw parsed JSON)
 *
 * Returns: { classified, workRelevant, extracted, updated }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { parseExport } from '@/lib/llm-export/parsers'
import { classifyAllConversations } from '@/lib/llm-export/privacy-classifier'
import { extractSignals, mergeSignals } from '@/lib/llm-export/signal-extractor'

export const dynamic = 'force-dynamic'
// Allow up to 10 MB for large export files
export const maxDuration = 60  // Haiku calls can take time

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()
    const candidateId = params.id

    // Verify candidate belongs to company
    const { data: candidate, error: candErr } = await supabase
      .from('imported_candidates')
      .select('id, full_name, skills, domain, years_experience')
      .eq('id', candidateId)
      .eq('company_id', company.id)
      .single()

    if (candErr || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Parse request — support both JSON body and form upload
    let rawExport: unknown

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

      const maxBytes = 10 * 1024 * 1024  // 10 MB
      if (file.size > maxBytes) {
        return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
      }

      const text = await file.text()
      try {
        rawExport = JSON.parse(text)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON in uploaded file' }, { status: 400 })
      }
    } else {
      const body = await req.json().catch(() => null)
      if (!body?.export) {
        return NextResponse.json({ error: 'Missing export field in body' }, { status: 400 })
      }
      rawExport = body.export
    }

    // 1. Parse export format
    let parseResult
    try {
      parseResult = parseExport(rawExport)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }

    if (parseResult.format === 'unknown' || parseResult.snippets.length === 0) {
      return NextResponse.json({
        error: 'Unrecognised export format or no conversations found',
        format: parseResult.format,
      }, { status: 400 })
    }

    // 2. Privacy classify (lc9)
    const classified = await classifyAllConversations(parseResult.snippets)
    const workRelevant = classified.filter(c => c.privacyClass === 'work_relevant')

    // Build snippet map for signal extraction
    const snippetMap: Record<number, string> = {}
    for (const s of parseResult.snippets) {
      snippetMap[s.index] = s.snippet
    }

    // 3. Extract signals
    const extracted = await extractSignals(workRelevant, snippetMap)

    // 4. Merge with existing fingerprint
    const merged = mergeSignals(
      {
        skills: candidate.skills ?? [],
        domain: candidate.domain ?? [],
        years_experience: candidate.years_experience ?? null,
      },
      extracted,
    )

    // 5. Persist to DB
    const { error: updateErr } = await supabase
      .from('imported_candidates')
      .update({
        skills: merged.skills,
        domain: merged.domain,
        years_experience: merged.years_experience,
        llm_export_processed_at: new Date().toISOString(),
        llm_export_summary: extracted.summary || null,
        llm_export_source: parseResult.format,
      })
      .eq('id', candidateId)
      .eq('company_id', company.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      candidateId,
      candidateName: candidate.full_name,
      format: parseResult.format,
      totalConversations: parseResult.totalConversations,
      classified: classified.length,
      workRelevant: workRelevant.length,
      personal: classified.filter(c => c.privacyClass === 'personal').length,
      neutral: classified.filter(c => c.privacyClass === 'neutral').length,
      extracted: {
        skills: extracted.skills,
        domain: extracted.domain,
        yearsExperience: extracted.yearsExperience,
        summary: extracted.summary,
        conversationsAnalysed: extracted.conversationsAnalysed,
      },
      merged,
    })
  } catch (err) {
    console.error('upload-llm-export error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
