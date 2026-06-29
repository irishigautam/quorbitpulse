import { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
import { jobSlug } from '@/types'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'
  const supabase = createServiceClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, posted_at')
    .eq('status', 'active')
    .order('posted_at', { ascending: false })

  const jobUrls: MetadataRoute.Sitemap = (jobs ?? []).map(job => ({
    url: `${appUrl}/jobs/${jobSlug(job)}`,
    lastModified: new Date(job.posted_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    { url: appUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${appUrl}/jobs`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${appUrl}/api-docs`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...jobUrls,
  ]
}
