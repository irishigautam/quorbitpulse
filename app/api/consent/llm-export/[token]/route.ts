/**
 * GET/POST /api/consent/llm-export/[token]
 *
 * Public, unauthenticated endpoints for the candidate-facing consent page
 * (Gate 1 — AI sync consent UX). The HMAC-signed token identifies the
 * candidate + company; no login required, matching the /api/chat/[token]
 * pattern used for AI chat sessions.
 *
 * GET  → current request details + status, for rendering the consent page.
 * POST → { approve: boolean } records the candidate's decision.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyConsentToken } from '@/lib/consent/token'

export const dynamic = 'force-dynamic'

async function loadRequest(token: string) {
  const payload = verifyConsentToken(token)
  if (!payload) return { error: 'invalid' as const }

  const supabase = createServiceClient()

  const { data: candidate, error } = await supabase
    .from('imported_candidates')
    .select('id, full_name, company_id, llm_consent_status, llm_consent_token, llm_consent_requested_at, llm_consent_expires_at')
    .eq('id', payload.candidateId)
    .eq('company_id', payload.companyId)
    .single()

  if (error || !candidate) return { error: 'invalid' as const }

  // A newer request may have overwritten this token — old links stop working.
  if (candidate.llm_consent_token !== token) return { error: 'superseded' as const }

  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', payload.companyId)
    .single()

  return { payload, candidate, companyName: company?.name ?? 'This company' }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const result = await loadRequest(token)

    if ('error' in result) {
      const status = result.error === 'superseded' ? 410 : 401
      return NextResponse.json(
        { error: result.error === 'superseded' ? 'A newer request has replaced this link.' : 'Invalid or expired link.' },
        { status },
      )
    }

    const { candidate, companyName } = result

    return NextResponse.json({
      candidateFirstName: candidate.full_name.split(' ')[0],
      companyName,
      status: candidate.llm_consent_status, // pending | approved | denied
      requestedAt: candidate.llm_consent_requested_at,
      expiresAt: candidate.llm_consent_expires_at,
    })
  } catch (err) {
    console.error('consent GET error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const result = await loadRequest(token)

    if ('error' in result) {
      const status = result.error === 'superseded' ? 410 : 401
      return NextResponse.json(
        { error: result.error === 'superseded' ? 'A newer request has replaced this link.' : 'Invalid or expired link.' },
        { status },
      )
    }

    const { payload, candidate } = result
    const body = await req.json().catch(() => null)

    if (typeof body?.approve !== 'boolean') {
      return NextResponse.json({ error: 'approve (boolean) is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error: updateErr } = await supabase
      .from('imported_candidates')
      .update({
        llm_consent_status: body.approve ? 'approved' : 'denied',
        llm_consent_responded_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)
      .eq('company_id', payload.companyId)

    if (updateErr) {
      console.error('consent POST update error:', updateErr)
      return NextResponse.json({ error: 'Failed to record your decision' }, { status: 500 })
    }

    return NextResponse.json({ status: body.approve ? 'approved' : 'denied' })
  } catch (err) {
    console.error('consent POST error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
