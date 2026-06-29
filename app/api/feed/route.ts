import { createServiceClient } from '@/lib/supabase/server'
import { jobSlug } from '@/types'

export const revalidate = 300 // 5 minutes

export async function GET() {
  const supabase = createServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, company:companies(name, website)')
    .eq('status', 'active')
    .order('posted_at', { ascending: false })
    .limit(100)

  const items = (jobs ?? [])
    .map((job: Record<string, unknown>) => {
      const company = job.company as { name: string; website: string }
      const slug = jobSlug(job as { id: string; title: string })
      const link = `${appUrl}/jobs/${slug}`
      const desc = String(job.description ?? '')
        .replace(/<[^>]*>/g, '')
        .slice(0, 300)
        .trim()

      return `
    <item>
      <title><![CDATA[${job.title} at ${company.name}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${desc}…]]></description>
      <author><![CDATA[${company.name}]]></author>
      <pubDate>${new Date(String(job.posted_at)).toUTCString()}</pubDate>
      <category><![CDATA[${String(job.job_type).replace('_', '-')}]]></category>
      <category><![CDATA[${job.location}]]></category>
    </item>`
    })
    .join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>JobPulse — Open Job Registry</title>
    <link>${appUrl}</link>
    <description>The latest jobs from JobPulse — post once, reach everywhere. Powered by Quorbit.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${appUrl}/api/feed" rel="self" type="application/rss+xml"/>
    <managingEditor>hello@quorbit.com (Quorbit)</managingEditor>
    <webMaster>hello@quorbit.com (Quorbit)</webMaster>
    <image>
      <url>${appUrl}/logo.png</url>
      <title>JobPulse</title>
      <link>${appUrl}</link>
    </image>
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300',
      'X-Powered-By': 'JobPulse by Quorbit',
    },
  })
}
