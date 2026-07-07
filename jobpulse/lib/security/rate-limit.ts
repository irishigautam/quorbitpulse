/**
 * Sliding-window rate limiter.
 *
 * Backends (in priority order):
 *   1. Upstash Redis — distributed, survives cold starts.
 *      Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in Vercel.
 *      Packages: @upstash/ratelimit @upstash/redis (npm install after adding to package.json)
 *   2. In-memory — per-instance fallback (dev / before Redis is provisioned).
 *
 * All public functions are async so callers use: `const rl = await rateLimit(...)`
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number   // sliding window size in milliseconds
  max: number        // max requests allowed in window
  keyPrefix: string  // namespace to avoid key collisions
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number     // epoch ms when window resets
  retryAfter?: number // seconds to wait (only when blocked)
}

// ── In-memory fallback ────────────────────────────────────────────────────────

interface RateWindow {
  timestamps: number[]
  blockedUntil?: number
}

const store = new Map<string, RateWindow>()

// Prune stale keys every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store.entries()) {
    if (win.timestamps.length === 0 && (!win.blockedUntil || win.blockedUntil < now)) {
      store.delete(key)
    }
  }
}, 10 * 60 * 1000)

function inMemoryRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.keyPrefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  let win = store.get(key)
  if (!win) {
    win = { timestamps: [] }
    store.set(key, win)
  }

  if (win.blockedUntil && win.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: win.blockedUntil,
      retryAfter: Math.ceil((win.blockedUntil - now) / 1000),
    }
  }

  win.timestamps = win.timestamps.filter(t => t > windowStart)
  const count = win.timestamps.length
  const resetAt = count > 0 ? win.timestamps[0] + config.windowMs : now + config.windowMs

  if (count >= config.max) {
    win.blockedUntil = now + config.windowMs * 2
    return {
      allowed: false,
      remaining: 0,
      resetAt: win.blockedUntil,
      retryAfter: Math.ceil((config.windowMs * 2) / 1000),
    }
  }

  win.timestamps.push(now)
  return { allowed: true, remaining: config.max - count - 1, resetAt }
}

// ── Upstash backend ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _redis: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _upstashLimiters = new Map<string, any>()

function msToUpstashDuration(ms: number): string {
  if (ms % (60 * 60_000) === 0) return `${ms / (60 * 60_000)} h`
  if (ms % 60_000 === 0)        return `${ms / 60_000} m`
  return `${Math.ceil(ms / 1000)} s`
}

async function upstashRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    // Dynamic imports — packages optional until installed
    const { Redis }     = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')

    if (!_redis) {
      _redis = new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }

    const limiterKey = `${config.keyPrefix}:${config.max}:${config.windowMs}`
    if (!_upstashLimiters.has(limiterKey)) {
      _upstashLimiters.set(limiterKey, new Ratelimit({
        redis:     _redis,
        limiter:   Ratelimit.slidingWindow(config.max, msToUpstashDuration(config.windowMs)),
        prefix:    `rl:${config.keyPrefix}`,
        analytics: false,
      }))
    }

    const { success, remaining, reset } = await _upstashLimiters.get(limiterKey)!.limit(identifier)
    const now    = Date.now()
    const resetAt = reset * 1000 // Upstash returns epoch seconds

    return {
      allowed:    success,
      remaining,
      resetAt,
      retryAfter: success ? undefined : Math.ceil((resetAt - now) / 1000),
    }
  } catch (e) {
    console.error('[rate-limit] Upstash error, falling back to in-memory:', e)
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const upstash = await upstashRateLimit(identifier, config)
  if (upstash !== null) return upstash
  return inMemoryRateLimit(identifier, config)
}

// ── Pre-configured limits ─────────────────────────────────────────────────────

export const LIMITS = {
  /** CSV import: 20 uploads / hour / company */
  candidateImport: (companyId: string) =>
    rateLimit(companyId, { windowMs: 60 * 60_000, max: 20, keyPrefix: 'import' }),

  /** Single fingerprint: 200 / hour / company */
  fingerprint: (companyId: string) =>
    rateLimit(companyId, { windowMs: 60 * 60_000, max: 200, keyPrefix: 'fp' }),

  /** Batch score: 30 / hour / company */
  scoreBatch: (companyId: string) =>
    rateLimit(companyId, { windowMs: 60 * 60_000, max: 30, keyPrefix: 'batch' }),

  /** Job create: 30 / hour / company */
  jobCreate: (companyId: string) =>
    rateLimit(companyId, { windowMs: 60 * 60_000, max: 30, keyPrefix: 'job-create' }),

  /** Auth / login attempts: 10 / 15 min / IP */
  auth: (ip: string) =>
    rateLimit(ip, { windowMs: 15 * 60_000, max: 10, keyPrefix: 'auth' }),

  /** Public chat replies: 60 messages / hour / session token */
  chat: (sessionToken: string) =>
    rateLimit(sessionToken, { windowMs: 60 * 60_000, max: 60, keyPrefix: 'chat' }),

  /** Send-chat trigger: 5 / hour / company (Resend quota protection) */
  sendChat: (companyId: string) =>
    rateLimit(companyId, { windowMs: 60 * 60_000, max: 5, keyPrefix: 'send-chat' }),
} as const

/** Build a 429 Response with standard rate-limit headers */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        'Retry-After': String(result.retryAfter ?? 60),
      },
    },
  )
}
