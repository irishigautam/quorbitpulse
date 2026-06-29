/**
 * Input sanitisation utilities.
 * Strip dangerous content from user-supplied strings before storage or LLM use.
 */

/** Remove HTML tags and dangerous control characters */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

/** Sanitise a person name — allow Unicode letters, numbers, spaces, common punctuation */
export function sanitizeName(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s'’\-.,()]/gu, '')
    .slice(0, 200)
    .trim()
}

/** Sanitise a URL — must use http/https scheme */
export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    // Block private/loopback addresses (SSRF prevention)
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/** Sanitise free-text notes — strip HTML, cap length */
export function sanitizeText(input: string, maxLength = 2000): string {
  return stripHtml(input).slice(0, maxLength)
}

/** Sanitise email — lowercase, trim, basic pattern check */
export function sanitizeEmail(input: string): string | null {
  const email = input.toLowerCase().trim()
  // Basic RFC 5321 length check + simple pattern
  if (email.length > 320) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null
  return email
}

/**
 * Detect prompt injection attempts in free-text fields.
 * Used before passing candidate-supplied text to Claude.
 */
export function detectPromptInjection(input: string): boolean {
  const patterns = [
    /ignore\s+(previous|above|all)\s+instructions/i,
    /disregard\s+(your|all|previous)\s+(instructions|prompt)/i,
    /you\s+are\s+now\s+(a|an)\s+/i,
    /act\s+as\s+(a\s+)?(different|new|evil|jailbreak)/i,
    /system\s*:\s*you\s+are/i,
    /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,
    /\bDAN\b.*\bjailbreak\b/i,
    /forget\s+(all|everything|your)\s+(previous|prior)/i,
  ]
  return patterns.some(p => p.test(input))
}

/**
 * Truncate and sanitize a string for safe inclusion in a prompt.
 * Combines stripHtml + injection detection + length cap.
 */
export function sanitizeForPrompt(input: string, maxLength = 500): string {
  const clean = stripHtml(input).slice(0, maxLength)
  if (detectPromptInjection(clean)) {
    // Replace the whole field with a safe placeholder
    return '[content removed by security filter]'
  }
  return clean
}
