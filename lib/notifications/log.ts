/**
 * P0-017 — notification reliability.
 *
 * Job-posted emails, stage-change emails, and HRMS webhooks were all
 * fire-and-forget with no record of whether they actually succeeded —
 * Promise.allSettled() swallows the result. notifyAttempt() wraps a single
 * send, records the outcome to notification_log (so failures are visible,
 * not just silently dropped), and never throws — safe to use inside
 * Promise.allSettled() blocks exactly like the calls it replaces.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { logError } from '@/lib/monitoring/log-error'

export async function notifyAttempt(params: {
  channel: 'email' | 'webhook'
  template: string
  companyId?: string | null
  recipient?: string | null
  metadata?: Record<string, unknown>
  send: () => Promise<void>
}): Promise<void> {
  try {
    await params.send()
    const supabase = createServiceClient()
    await supabase.from('notification_log').insert({
      channel: params.channel,
      template: params.template,
      company_id: params.companyId ?? null,
      recipient: params.recipient ?? null,
      status: 'ok',
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    const message = String(err)
    try {
      const supabase = createServiceClient()
      await supabase.from('notification_log').insert({
        channel: params.channel,
        template: params.template,
        company_id: params.companyId ?? null,
        recipient: params.recipient ?? null,
        status: 'error',
        error: message.slice(0, 2000),
        metadata: params.metadata ?? {},
      })
    } catch (logErr) {
      console.error('notifyAttempt: failed to record failure:', logErr)
    }
    await logError({
      route: `notification:${params.template}`,
      message,
      context: { channel: params.channel, companyId: params.companyId, recipient: params.recipient },
    })
  }
}
