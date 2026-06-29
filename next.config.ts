import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Allow MCP server to be served
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Powered-By', value: 'JobPulse by Quorbit' },
        ],
      },
    ]
  },
}

export default nextConfig
