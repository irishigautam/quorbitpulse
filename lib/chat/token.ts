/**
 * HMAC-SHA256 signed chat tokens for Phase 3 candidate chat sessions.
 *
 * Token format (URL-safe base64 of JSON payload + ".sig"):
 *   <base64url(payload)>.<base64url(hmac)>
 *
 * Payload: { sessionId, candidateId, jobId, companyId, exp }
 * Signed with CHAT_TOKEN_SECRET env var.
 *
 * Tokens are single-use per session, time-limited, and verified server-side
 * on every chat API call. They do not require the candidate to have an account.
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.CHAT_TOKEN_SECRET || 'CHAT_TOKEN_SECRET_NOT_SET'
const ALGO = 'sha256'
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface ChatTokenPayload {
  sessionId: string
  candidateId: string
  jobId: string
  companyId: string
  exp: number // epoch ms
}

function toBase64Url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8')
}

function sign(data: string): string {
  return createHmac(ALGO, SECRET).update(data).digest('base64url')
}

/** Create a signed chat token valid for 7 days */
export function createChatToken(payload: Omit<ChatTokenPayload, 'exp'>): string {
  const full: ChatTokenPayload = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payloadB64 = toBase64Url(JSON.stringify(full))
  const sig = sign(payloadB64)
  return `${payloadB64}.${sig}`
}

/** Verify a chat token. Returns payload or null if invalid/expired. */
export function verifyChatToken(token: string): ChatTokenPayload | null {
  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return null

    // Timing-safe signature comparison
    const expectedSig = sign(payloadB64)
    const sigBuf = Buffer.from(sig, 'base64url')
    const expectedBuf = Buffer.from(expectedSig, 'base64url')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null

    const payload = JSON.parse(fromBase64Url(payloadB64)) as ChatTokenPayload

    // Expiry check
    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}
