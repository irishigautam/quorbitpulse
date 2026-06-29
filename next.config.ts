import type { NextConfig } from 'next'
import { SECURITY_HEADERS } from './lib/security/headers'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Restrict to known safe hostnames rather than wildcard
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'media.licdn.com' },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to every route
        source: '/(.*)',
        headers: [
          ...SECURITY_HEADERS,
          // Identify the platform (non-sensitive)
          { key: 'X-Powered-By', value: 'Quorbit Pulse' },
        ],
      },
    ]
  },
}

export default nextConfig
