/**
 * Shared CORS headers for the public /api/v1/* surface.
 *
 * Before this file existed, each v1 route defined its own inline header
 * object (see app/api/v1/jobs/route.ts's cacheHeaders()) and two routes -
 * /api/v1/match and /api/v1/university - had no CORS headers at all, an
 * inconsistency that happened because each route was hand-written
 * independently rather than against one shared contract. New v1 routes
 * should import this instead of redefining their own header object.
 */

export function publicApiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'X-Powered-By': 'JobPulse by Quorbit',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra,
  }
}

/** Standard OPTIONS handler for a public v1 route - export this as `OPTIONS` from the route file. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: publicApiHeaders() })
}
