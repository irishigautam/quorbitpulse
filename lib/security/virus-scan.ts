/**
 * VirusTotal file scan — hash-check only (fast, < 300 ms typical).
 *
 * Strategy:
 *   1. SHA-256 hash the buffer.
 *   2. GET /api/v3/files/{hash} — check if VirusTotal already knows this file.
 *   3. Known malicious (malicious + suspicious engines > 0) → reject.
 *   4. Unknown (404) or clean → allow.
 *   5. Fail open on any error / timeout / missing API key (dev mode).
 *
 * Set VIRUSTOTAL_API_KEY in Vercel to enable scanning.
 * Free tier: 500 lookups/day, no upload required for hash checks.
 */

import { createHash } from 'crypto'

export type ScanResult =
  | { safe: true }
  | { safe: false; reason: string }

const VT_BASE         = 'https://www.virustotal.com/api/v3'
const SCAN_TIMEOUT_MS = 4000

export async function scanFile(buffer: Buffer): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY
  if (!apiKey) {
    // Not configured — skip scanning (dev / missing key)
    return { safe: true }
  }

  const hash = createHash('sha256').update(buffer).digest('hex')

  try {
    const res = await fetch(`${VT_BASE}/files/${hash}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    })

    if (res.status === 404) {
      // File not in VT database → not a known threat
      return { safe: true }
    }

    if (!res.ok) {
      console.warn(`[virus-scan] VirusTotal responded ${res.status} — failing open`)
      return { safe: true }
    }

    const data       = await res.json()
    const stats      = data?.data?.attributes?.last_analysis_stats as Record<string, number> | undefined
    const malicious  = (stats?.malicious  ?? 0)
    const suspicious = (stats?.suspicious ?? 0)

    if (malicious > 0 || suspicious > 2) {
      return {
        safe:   false,
        reason: `File flagged by ${malicious} malicious / ${suspicious} suspicious VirusTotal engines`,
      }
    }

    return { safe: true }
  } catch (e: unknown) {
    const err = e as { name?: string }
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      console.warn('[virus-scan] VirusTotal timeout — failing open')
    } else {
      console.error('[virus-scan] error:', e)
    }
    return { safe: true } // fail open — don't block legitimate uploads on VT downtime
  }
}
