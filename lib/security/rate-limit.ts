/**
 * In-memory sliding-window rate limiter.
 *
 * Per-instance (each Vercel serverless function has its own memory).
 * Good enough for API abuse prevention at this scale.
 * For distributed rate limiting at high scale: replace backing store with
 * Upstash Redis via @upstash/ratelimit.
 */

interface RateWindow {
  timestamps: number[]
  blockedUntil?: number
}

const store = new Map<string, RateWindow>()

// Prune stale keys every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store.entries()) {
    if (
      win.timestamps.length === 0 &&
      (!win.blockedUntil || win.blockedUntil < now)
    ) {
      store.delete(key)
    }
  }
}, 10 * 60 * 1000)

export interface RateLimitConfig {
  windowMs: number  // sliding window size in milliseconds
  max: number       // max requests allowed in window
  keyPrefix: string // namespace to avoid key collisions
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number    // epoch ms when window resets
  retryAfter?: number // seconds to wait (only when blocked)
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const key = `${config.keyPrefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  let win = store.get(key)
  if (!win) {
    win = { timestamps: [] }
    store.set(key, win)
  }

  // Hard-block check
  if (win.blockedUntil && win.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: win.blockedUntil,
      retryAfter: Math.ceil((win.blockedUntil - now) / 1000),
    }
  }

  // Slide window
  win.timestamps = win.timestamps.filter(t => t > windowStart)

  const count = win.timestamps.length
  const resetAt = count > 0
    ? win.timestamps[0] + config.windowMs
    : now + config.windowMs

  if (count >= config.max) {
    // On violation, hard-block for 2× the window
    win.blockedUntil = now + config.windowMs * 2
    return {
      allowed: false,
      remaining: 0,
      resetAt: win.blockedUntil,
      retryAfter: Math.ceil((config.windowMs * 2) / 1000),
    }
  }

  win.timestamps.push(now)
  return {
    allowed: true,
    remaining: config.max - count - 1,
    resetAt,
  }
}

// ── Pre-configured limits ──────────────────────────────────────────────────────

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
