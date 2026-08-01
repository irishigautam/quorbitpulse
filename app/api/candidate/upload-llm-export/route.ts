/**
 * POST /api/candidate/upload-llm-export
 *
 * Self-service version of the employer-side lc8 feature
 * (app/api/candidates/[id]/upload-llm-export). That route lets a recruiter
 * upload a candidate's ChatGPT/Claude export, gated on the candidate's
 * explicit consent. This route is the candidate uploading their OWN export
 * about themselves — no consent gate needed, since it's their own data and
 * their own choice to share it.
 *
 * Flow (identical pipeline, reused):
 *   1. Parse export JSON (ChatGPT or Claude format)
 *   2. Run privacy classifier — only work_relevant passes through
 *   3. Extract work signals via Claude Haiku
 *   4. Merge signals into the candidate's fingerprint (skills, domain, years_experience)
 *   5. Persist to candidate_profiles + record llm_export_processed_at
 *
 * Body: multipart/form-data with field `file` (JSON export file)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { parseExport } from '@/lib/llm-export/parsers'
import { classifyAllConversations } from '@/lib/llm-export/privacy-classifier'
import { extractSignals, mergeSignals } from '@/lib/llm-export/signal-extractor'
import { LIMITS } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Haiku calls can take time

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await requireCandidate()

    const rl = LIMITS.candidateLlmExport(candidate.id)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'You can upload up to 3 exports per hour. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
      )
    }

    const contentType = req.headers.get('content-type') ?? ''
    let rawExport: unknown

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

      const maxBytes = 10 * 1024 * 1024 // 10 MB
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

    // 2. Privacy classify — only work-relevant snippets ever leave this step
    const classified = await classifyAllConversations(parseResult.snippets)
    const workRelevant = classified.filter(c => c.privacyClass === 'work_relevant')

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

    // 5. Persist to candidate_profiles
    const supabase = createServiceClient()
    const { error: updateErr } = await supabase
      .from('candidate_profiles')
      .update({
        skills: merged.skills,
        domain: merged.domain,
        years_experience: merged.years_experience,
        llm_export_processed_at: new Date().toISOString(),
        llm_export_summary: extracted.summary || null,
        llm_export_source: parseResult.format,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
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
    console.error('candidate upload-llm-export error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
