/**
 * ats7 — HRMS webhook
 * Fires on hire/reject events to Zoho Recruit, Keka, greytHR, or any custom webhook.
 * Company configures webhook URL in settings (stored in companies.hrms_webhook_url).
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface WebhookPayload {
  companyId: string
  event: 'candidate.hired' | 'candidate.rejected' | 'candidate.stage_changed'
  candidateId: string
  candidateName: string
  jobId?: string
  jobTitle?: string
  stage: string
  timestamp?: string
}

export async function fireHrmsWebhook(payload: WebhookPayload) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('hrms_webhook_url, hrms_webhook_secret')
    .eq('id', payload.companyId)
    .single()

  if (!company?.hrms_webhook_url) return  // no webhook configured

  const body = JSON.stringify({
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Quorbit-Event': payload.event,
    'X-Quorbit-Company': payload.companyId,
  }

  // HMAC signature for webhook verification
  if (company.hrms_webhook_secret) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(company.hrms_webhook_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    headers['X-Quorbit-Signature'] = 'sha256=' + Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  }

  await fetch(company.hrms_webhook_url, { method: 'POST', headers, body })
}
