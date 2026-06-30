/**
 * LinkedIn distribution channel.
 *
 * Uses the LinkedIn UGC Post API (no partner approval needed).
 * The recruiter connects their LinkedIn Company Page via OAuth in
 * /dashboard/settings/distribution — we store the access token + org URN.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */

import type { Job } from '@/types'
import type { Database } from '@/types/supabase'
import type { DistributionResult } from './indeed'

type Company = Database['public']['Tables']['companies']['Row']

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'
const LI_API = 'https://api.linkedin.com/v2'

export async function distributeToLinkedIn(
  job: Job,
  company: Company
): Promise<DistributionResult> {
  const token = (company as any).linkedin_access_token
  const orgUrn = (company as any).linkedin_org_urn

  if (!token || !orgUrn) {
    return {
      status: 'skipped',
      error: 'LinkedIn not connected — visit Settings → Distribution to connect.',
      distributed_at: new Date().toISOString(),
    }
  }

  const expiresAt = (company as any).linkedin_token_expires_at
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return {
      status: 'error',
      error: 'LinkedIn token expired — reconnect in Settings → Distribution.',
      distributed_at: new Date().toISOString(),
    }
  }

  const jobUrl = `${APP_URL}/jobs/${job.id}`
  const skills = Array.isArray(job.skills) ? (job.skills as string[]).slice(0, 5).join(' • ') : ''
  const salary =
    job.salary_min && job.salary_max
      ? ` | ${job.salary_currency ?? '₹'}${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()}`
      : ''

  const postText = `🚀 We're hiring: ${job.title}

📍 ${job.location}${job.remote ? ' (Remote-friendly)' : ''}
⏱ ${formatJobType(job.job_type)}${salary}
${skills ? `🛠 ${skills}` : ''}

Apply now 👇
${jobUrl}

#Hiring #Jobs #${job.title.replace(/\s+/g, '')} #Quorbit`

  const body = {
    author: orgUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: postText },
        shareMediaCategory: 'ARTICLE',
        media: [
          {
            status: 'READY',
            description: { text: job.description.slice(0, 256) },
            originalUrl: jobUrl,
            title: { text: `${job.title} — ${company.name}` },
          },
        ],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  try {
    const res = await fetch(`${LI_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text()
      return {
        status: 'error',
        error: `LinkedIn API ${res.status}: ${err}`,
        distributed_at: new Date().toISOString(),
      }
    }

    const data = await res.json()
    const postId = data.id ?? ''
    const postUrl = postId
      ? `https://www.linkedin.com/feed/update/${postId}/`
      : undefined

    return {
      status: 'ok',
      url: postUrl,
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

function formatJobType(type: string | null): string {
  switch (type) {
    case 'full_time': return 'Full-time'
    case 'part_time': return 'Part-time'
    case 'contract': return 'Contract'
    case 'internship': return 'Internship'
    case 'freelance': return 'Freelance'
    default: return 'Full-time'
  }
}

/** Exchange LinkedIn auth code for access token */
export async function exchangeLinkedInCode(code: string, redirectUri: string) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  })
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

/** Fetch the user's LinkedIn organizations (company pages) */
export async function getLinkedInOrgs(accessToken: string) {
  const res = await fetch(
    `${LI_API}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName)))`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.elements ?? []).map((el: any) => ({
    urn: `urn:li:organization:${el['organizationalTarget~']?.id}`,
    name: el['organizationalTarget~']?.localizedName ?? 'Unknown page',
  }))
}
