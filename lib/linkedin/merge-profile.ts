/**
 * merge-profile.ts — Claude Haiku merges LinkedIn + resume fingerprint
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ProxycurlProfile } from './proxycurl'

const client = new Anthropic()

export interface MergedFingerprint {
  current_title: string | null
  current_company: string | null
  location: string | null
  skills: string[]
  domain: string[]
  seniority: string | null
  years_experience: number | null
  fingerprint_summary: string
  projects: { name: string; description: string; url: string | null }[]
  certifications: { name: string; issuer: string; issued_at: string | null }[]
  publications: { title: string; url: string | null; published_at: string | null }[]
}

export async function mergeLinkedInProfile(
  existing: {
    current_title: string | null
    current_company: string | null
    location: string | null
    skills: string[]
    domain: string[]
    seniority: string | null
    years_experience: number | null
    fingerprint_summary: string | null
  },
  linkedin: ProxycurlProfile,
): Promise<MergedFingerprint> {

  const liExp = linkedin.experiences.slice(0, 6).map(e =>
    `${e.title ?? 'Unknown role'} @ ${e.company ?? 'Unknown'} (${e.starts_at?.year ?? '?'}–${e.ends_at?.year ?? 'present'})`
  ).join('\n')

  const prompt = `You are merging a candidate's resume fingerprint with their LinkedIn profile data.
Return a single enriched JSON object. Deduplicate skills, prefer more specific/recent values.

EXISTING RESUME:
Title: ${existing.current_title ?? 'unknown'}
Company: ${existing.current_company ?? 'unknown'}
Location: ${existing.location ?? 'unknown'}
Skills: ${existing.skills.join(', ') || 'none'}
Domain: ${existing.domain.join(', ') || 'none'}
Seniority: ${existing.seniority ?? 'unknown'}
Years: ${existing.years_experience ?? 'unknown'}
Summary: ${existing.fingerprint_summary ?? ''}

LINKEDIN:
Name: ${linkedin.full_name ?? 'unknown'}
Headline: ${linkedin.headline ?? 'none'}
Summary: ${linkedin.summary ?? 'none'}
Location: ${linkedin.location ?? 'unknown'}
Skills: ${linkedin.skills.slice(0, 30).join(', ') || 'none'}
Experience:
${liExp || 'none'}

Return ONLY valid JSON:
{
  "current_title": string or null,
  "current_company": string or null,
  "location": string or null,
  "skills": string[],
  "domain": string[],
  "seniority": "intern"|"junior"|"mid"|"senior"|"lead"|"principal"|null,
  "years_experience": number or null,
  "fingerprint_summary": string
}`

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as any).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.replace(/```(?:json)?\n?/g, '').trim() : raw

  let core: Omit<MergedFingerprint, 'projects' | 'certifications' | 'publications'>
  try {
    core = JSON.parse(jsonStr)
  } catch {
    const merged = Array.from(new Set([...existing.skills, ...linkedin.skills.slice(0, 15)])).slice(0, 25)
    core = {
      current_title: existing.current_title ?? linkedin.occupation,
      current_company: existing.current_company ?? linkedin.experiences[0]?.company ?? null,
      location: existing.location ?? linkedin.location,
      skills: merged,
      domain: existing.domain,
      seniority: existing.seniority,
      years_experience: existing.years_experience,
      fingerprint_summary: existing.fingerprint_summary ?? linkedin.summary ?? '',
    }
  }

  return {
    ...core,
    projects: (linkedin.accomplishment_projects ?? []).slice(0, 10).map(p => ({
      name: p.title ?? 'Untitled project',
      description: p.description ?? '',
      url: p.url ?? null,
    })),
    certifications: (linkedin.certifications ?? []).slice(0, 10).map(c => ({
      name: c.name ?? 'Untitled certification',
      issuer: c.authority ?? '',
      issued_at: c.starts_at?.year ? String(c.starts_at.year) : null,
    })),
    publications: (linkedin.accomplishment_publications ?? []).slice(0, 10).map(p => ({
      title: p.name ?? 'Untitled publication',
      url: p.url ?? null,
      published_at: p.published_on?.year ? String(p.published_on.year) : null,
    })),
  }
}
