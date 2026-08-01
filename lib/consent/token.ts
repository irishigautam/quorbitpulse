/**
 * HMAC-SHA256 signed consent tokens for candidate LLM-export opt-in (Gate 1).
 *
 * Token format (URL-safe base64 of JSON payload + ".sig"):
 *   <base64url(payload)>.<base64url(hmac)>
 *
 * Payload: { candidateId, companyId, exp }
 * Signed with CONSENT_TOKEN_SECRET env var.
 *
 * Tokens are also mirrored into imported_candidates.llm_consent_token so a
 * fresh request can invalidate an older, unresponded one (matches the
 * chat_sessions dual-verification pattern in lib/chat/token.ts).
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.CONSENT_TOKEN_SECRET || 'CONSENT_TOKEN_SECRET_NOT_SET'
const ALGO = 'sha256'
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface ConsentTokenPayload {
  candidateId: string
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

/** Create a signed consent token valid for 7 days */
export function createConsentToken(payload: Omit<ConsentTokenPayload, 'exp'>): string {
  const full: ConsentTokenPayload = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payloadB64 = toBase64Url(JSON.stringify(full))
  const sig = sign(payloadB64)
  return `${payloadB64}.${sig}`
}

/** Verify a consent token. Returns payload or null if invalid/expired. */
export function verifyConsentToken(token: string): ConsentTokenPayload | null {
  try {
    const [payloadB64, sig] = token.split('.')
    if (!payloadB64 || !sig) return null

    const expectedSig = sign(payloadB64)
    const sigBuf = Buffer.from(sig, 'base64url')
    const expectedBuf = Buffer.from(expectedSig, 'base64url')
    if (sigBuf.length !== expectedBuf.length) return null
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null

    const payload = JSON.parse(fromBase64Url(payloadB64)) as ConsentTokenPayload

    if (Date.now() > payload.exp) return null

    return payload
  } catch {
    return null
  }
}
