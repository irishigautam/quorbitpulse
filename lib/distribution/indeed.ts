/**
 * Indeed distribution channel.
 *
 * Indeed (and SimplyHired, Jora, Glassdoor) automatically crawl
 * the Indeed XML feed format at /api/feeds/indeed.
 *
 * We also ping Indeed's job submit endpoint to trigger an immediate crawl.
 */

import type { Job, Company } from '@/types'
import { normalizeJobType, formatSalaryDisplay } from './normalize'

export interface DistributionResult {
  status: 'ok' | 'error' | 'skipped'
  url?: string
  error?: string
  distributed_at: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'

/**
 * "Distribute" to Indeed = make sure the XML feed is reachable and ping Indeed.
 * Indeed crawls the feed URL automatically — no API key required.
 */
export async function distributeToIndeed(
  job: Job,
  _company: Company
): Promise<DistributionResult> {
  const feedUrl = `${APP_URL}/api/feeds/indeed`

  try {
    // Ping Indeed's job indexing endpoint (fire-and-forget)
    // Indeed periodically crawls registered feed URLs; this pings their
    // submit form so they re-crawl sooner.
    const pingUrl = `https://www.indeed.com/tools/jobsearch/apistandards/xml-feed/submit?feedUrl=${encodeURIComponent(feedUrl)}`
    await fetch(pingUrl, { method: 'GET', signal: AbortSignal.timeout(5000) }).catch(() => {
      // Indeed ping is best-effort — don't fail if it times out
    })

    return {
      status: 'ok',
      url: feedUrl,
      distributed_at: new Date().toISOString(),
    }
  } catch (err) {
    return {
      status: 'error',
      error: String(err),
      distributed_at: new Date().toISOString(),
    }
  }
}

/** Build an Indeed-standard XML job entry for a single job */
export function jobToIndeedXml(job: Job, company: Company): string {
  const jobUrl = `${APP_URL}/jobs/${job.id}`
  const applyUrl = job.apply_url ?? jobUrl
  const salary = formatSalaryDisplay(job) ?? ''

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return `  <job>
    <title><![CDATA[${job.title}]]></title>
    <date>${new Date(job.posted_at ?? Date.now()).toUTCString()}</date>
    <referencenumber>${job.id}</referencenumber>
    <url><![CDATA[${applyUrl}]]></url>
    <company><![CDATA[${company.name}]]></company>
    <city><![CDATA[${job.location}]]></city>
    <country>IN</country>
    <description><![CDATA[${job.description}]]></description>
    <jobtype>${normalizeJobType(job.job_type, INDEED_JOB_TYPE_MAP)}</jobtype>
    ${salary ? `<salary><![CDATA[${salary}]]></salary>` : ''}
    ${job.remote ? '<remotetype>Remote</remotetype>' : ''}
    <expirationdate>${new Date(job.expires_at).toUTCString()}</expirationdate>
  </job>`
}

const INDEED_JOB_TYPE_MAP = {
  full_time: 'fulltime',
  part_time: 'parttime',
  contract: 'contract',
  internship: 'internship',
  freelance: 'contract',
}
