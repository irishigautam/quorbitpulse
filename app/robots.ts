import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/onboarding/', '/api/cron/'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
