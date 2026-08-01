/**
 * LinkedIn distribution channel.
 *
 * Uses the LinkedIn UGC Post API (no partner approval needed).
 * The recruiter connects their LinkedIn Company Page via OAuth in
 * /dashboard/integrations — we store the access token + org URN
 * in the integration_configs table.
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */

import type { Job, Company } from '@/types'
import type { IntegrationConfig, PostResult } from '@/lib/integrations/handlers'
import { normalizeJobType, formatSalaryDisplay } from './normalize'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'
const LI_API = 'https://api.linkedin.com/v2'

/**
 * Distribute a job to LinkedIn via UGC Posts API.
 *
 * @param config - The integration_configs row for the 'linkedin' platform.
 *   access_token = OAuth token, extra_key = org URN (urn:li:organization:XXXXXX).
 *   Falls back to legacy company columns for backward compatibility.
 */
export async function distributeToLinkedIn(
  job: Job,
  company: Company,
  config?: IntegrationConfig,
): Promise<PostResult> {
  // Prefer integration_configs (new schema), fall back to company columns (legacy)
  const token = config?.access_token ?? (company as any).linkedin_access_token
  const orgUrn = config?.extra_key ?? (company as any).linkedin_org_urn

  if (!token || !orgUrn) {
    return {
      status: 'skipped',
      error: 'LinkedIn not connected — visit Integrations to connect.',
      distributed_at: new Date().toISOString(),
    }
  }

  // Check token expiry from integration_configs row
  const expiresAt = config?.expires_at ?? (company as any).linkedin_token_expires_at
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return {
      status: 'error',
      error: 'LinkedIn token expired — reconnect in Integrations.',
      distributed_at: new Date().toISOString(),
    }
  }

  const jobUrl = `${APP_URL}/jobs/${job.id}`
  const skills = Array.isArray(job.skills) ? (job.skills as string[]).slice(0, 5).join(' • ') : ''
  const salaryDisplay = formatSalaryDisplay(job)
  const salary = salaryDisplay ? ` | ${salaryDisplay.replace(' per year', '')}` : ''

  const postText = `🚀 We're hiring: ${job.title}

📍 ${job.location}${job.remote ? ' (Remote-friendly)' : ''}
⏱ ${normalizeJobType(job.job_type, LINKEDIN_JOB_TYPE_MAP)}${salary}
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
      const errText = await res.text()
      return {
        status: 'error',
        error: `LinkedIn API ${res.status}: ${errText}`,
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

const LINKEDIN_JOB_TYPE_MAP = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
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
