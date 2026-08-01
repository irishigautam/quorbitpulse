/**
 * P0-022 — global request error capture.
 *
 * Next's onRequestError hook fires for unhandled errors thrown in Server
 * Components, Route Handlers, and Server Actions — the cases a try/catch
 * around a specific fetch call can't cover. Logs to error_log via the same
 * logError() helper used for explicit call sites, so /admin has one place
 * to see everything.
 */

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  // Avoid pulling in server-only Supabase client at module scope for edge
  // compatibility — import lazily inside the hook.
  const { logError } = await import('@/lib/monitoring/log-error')

  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined

  await logError({
    route: request.path,
    message,
    stack,
    context: {
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    },
  })
}
