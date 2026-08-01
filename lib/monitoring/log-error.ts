/**
 * P0-022 — self-hosted error monitoring baseline.
 *
 * A real Sentry/Datadog-style integration would require creating a new
 * external account, which isn't something to do autonomously. This is the
 * minimal functional substitute: every unhandled request error (wired via
 * instrumentation.ts's onRequestError hook) and every explicit logError()
 * call lands in the error_log table, visible from /admin.
 */

import { createServiceClient } from '@/lib/supabase/server'

export async function logError(params: {
  route?: string | null
  message: string
  stack?: string | null
  context?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('error_log').insert({
      route: params.route ?? null,
      message: params.message.slice(0, 2000),
      stack: params.stack?.slice(0, 4000) ?? null,
      context: params.context ?? {},
    })
  } catch (err) {
    // Last resort — never let error logging itself throw.
    console.error('logError failed:', err)
  }
}
