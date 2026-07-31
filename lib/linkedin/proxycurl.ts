/**
 * Proxycurl integration — fetches a public LinkedIn profile by URL.
 *
 * Docs: https://nubela.co/proxycurl/docs#people-api-person-profile-endpoint
 * Requires: PROXYCURL_API_KEY env var
 *
 * Pricing: ~$0.01 per successful lookup.
 * Free trial: 10 credits.
 */

export interface ProxycurlExperience {
  company: string | null
  title: string | null
  description: string | null
  starts_at: { year: number | null; month: number | null; day: number | null } | null
  ends_at: { year: number | null; month: number | null; day: number | null } | null
  location: string | null
}

export interface ProxycurlEducation {
  school: string | null
  degree_name: string | null
  field_of_study: string | null
  starts_at: { year: number | null } | null
  ends_at: { year: number | null } | null
}

export interface ProxycurlCertification {
  name: string | null
  authority: string | null
  starts_at: { year: number | null } | null
}

export interface ProxycurlProject {
  title: string | null
  description: string | null
  url: string | null
  starts_at: { year: number | null } | null
}

export interface ProxycurlPublication {
  name: string | null
  url: string | null
  published_on: { year: number | null } | null
  description: string | null
}

export interface ProxycurlProfile {
  full_name: string | null
  headline: string | null
  summary: string | null
  occupation: string | null
  location: string | null
  city: string | null
  country: string | null
  skills: string[]
  experiences: ProxycurlExperience[]
  education: ProxycurlEducation[]
  certifications: ProxycurlCertification[]
  accomplishment_projects: ProxycurlProject[]
  accomplishment_publications: ProxycurlPublication[]
  profile_pic_url: string | null
  public_identifier: string | null
}

export type ProxycurlResult =
  | { ok: true; profile: ProxycurlProfile }
  | { ok: false; reason: 'private' | 'not_found' | 'api_error'; message: string }

export async function fetchLinkedInProfile(linkedinUrl: string): Promise<ProxycurlResult> {
  const apiKey = process.env.PROXYCURL_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'api_error', message: 'PROXYCURL_API_KEY not configured' }
  }

  const url = normaliseLinkedInUrl(linkedinUrl)
  if (!url) {
    return { ok: false, reason: 'not_found', message: 'Invalid LinkedIn URL' }
  }

  const params = new URLSearchParams({
    url,
    skills: 'include',
    certifications: 'include',
    projects: 'include',
    publications: 'include',
  })

  let resp: Response
  try {
    resp = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
    })
  } catch (err: any) {
    return { ok: false, reason: 'api_error', message: err.message ?? 'Network error' }
  }

  if (resp.status === 404) return { ok: false, reason: 'not_found', message: 'LinkedIn profile not found' }
  if (resp.status === 403 || resp.status === 401) return { ok: false, reason: 'private', message: 'Profile is private or restricted' }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    return { ok: false, reason: 'api_error', message: `Proxycurl ${resp.status}: ${body.slice(0, 200)}` }
  }

  const data = await resp.json()

  if (!data.full_name && !data.headline && !data.occupation) {
    return { ok: false, reason: 'private', message: 'Profile is private — no data returned' }
  }

  return {
    ok: true,
    profile: {
      full_name: data.full_name ?? null,
      headline: data.headline ?? null,
      summary: data.summary ?? null,
      occupation: data.occupation ?? null,
      location: data.location ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      skills: Array.isArray(data.skills) ? data.skills.filter(Boolean) : [],
      experiences: Array.isArray(data.experiences) ? data.experiences : [],
      education: Array.isArray(data.education) ? data.education : [],
      certifications: Array.isArray(data.certifications) ? data.certifications : [],
      accomplishment_projects: Array.isArray(data.accomplishment_projects) ? data.accomplishment_projects : [],
      accomplishment_publications: Array.isArray(data.accomplishment_publications) ? data.accomplishment_publications : [],
      profile_pic_url: data.profile_pic_url ?? null,
      public_identifier: data.public_identifier ?? null,
    }
  }
}

function normaliseLinkedInUrl(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (!u.hostname.includes('linkedin.com')) return null
    if (!u.pathname.startsWith('/in/')) return null
    const slug = u.pathname.replace(/\/in\/([^/]+)\/?.*/, '/in/$1')
    return `https://www.linkedin.com${slug}`
  } catch {
    return null
  }
}
