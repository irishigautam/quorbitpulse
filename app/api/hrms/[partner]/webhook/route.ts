/**
 * POST /api/hrms/[partner]/webhook
 *
 * inf2 — HRMS partner webhook receiver.
 * Partners: zoho_recruit | keka | greythr
 *
 * Validates HMAC-SHA256 signature from company's hrms_webhook_secret,
 * then updates candidate pipeline stage in Quorbit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { normalise } from '@/lib/hrms/adapters'
import type { HrmsPartner } from '@/lib/hrms/adapters'

export const dynamic = 'force-dynamic'

const VALID_PARTNERS = new Set<HrmsPartner>(['zoho_recruit', 'keka', 'greythr'])

const STAGE_MAP: Record<string, string> = {
  candidate_hired:   'hired',
  candidate_rejected: 'rejected',
  new_candidate:     'sourced',
  stage_change:      'screened',
}

export async function POST(
  req: NextRequest,
  { params }: { params: { partner: string } }
) {
  const partner = params.partner as HrmsPartner
  if (!VALID_PARTNERS.has(partner)) {
    return NextResponse.json({ error: 'Unknown partner' }, { status: 404 })
  }

  const rawBody = await req.text()
  const supabase = createServiceClient()

  // Find company by shared secret (passed via X-Quorbit-Company header or query param)
  const companyId = req.headers.get('x-quorbit-company') ?? req.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const { data: company } = await supabase
    .from('companies')
    .select('id, hrms_webhook_secret')
    .eq('id', companyId)
    .single()

  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  // Validate HMAC signature
  const sig = req.headers.get('x-quorbit-signature') ?? req.headers.get('x-hub-signature-256')
  if (company.hrms_webhook_secret && sig) {
    const expectedSig = 'sha256=' + createHmac('sha256', company.hrms_webhook_secret)
      .update(rawBody)
      .digest('hex')
    if (sig !== expectedSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = normalise(partner, payload)
  const pipelineStage = STAGE_MAP[event.event_type] ?? 'screened'

  // Try to find candidate in our pool by email
  if (event.candidate_email) {
    const { data: candidate } = await supabase
      .from('imported_candidates')
      .select('id')
      .eq('email', event.candidate_email)
      .eq('company_id', company.id)
      .single()

    if (candidate) {
      // Update all pipeline assignments for this candidate at this company
      await supabase
        .from('candidate_job_assignments')
        .update({ pipeline_stage: pipelineStage, updated_at: new Date().toISOString() })
        .eq('candidate_id', candidate.id)
        .eq('company_id', company.id)

      // Update candidate status on terminal stages
      if (event.event_type === 'candidate_hired') {
        await supabase.from('imported_candidates').update({ status: 'hired' }).eq('id', candidate.id)
      } else if (event.event_type === 'candidate_rejected') {
        await supabase.from('imported_candidates').update({ status: 'rejected' }).eq('id', candidate.id)
      }
    }
  }

  return NextResponse.json({ received: true, event_type: event.event_type, partner })
}
