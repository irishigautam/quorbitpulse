/**
 * Security response headers.
 * Applied via next.config.ts (all routes) and augmented in middleware.ts.
 */

export const SECURITY_HEADERS = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },

  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Control referrer info sent to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Disable browser features not used by this app
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()',
  },

  // HSTS — force HTTPS for 1 year, include subdomains, eligible for preload list
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },

  // DNS prefetch
  { key: 'X-DNS-Prefetch-Control', value: 'on' },

  // Content Security Policy
  // NOTE: 'unsafe-inline' on script-src is required by Next.js turbopack.
  // 'unsafe-eval' is required by Next.js dev mode (not present in prod builds but kept for parity).
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.razorpay.com https://checkout.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
] as const satisfies { key: string; value: string }[]
