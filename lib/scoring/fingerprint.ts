/**
 * Phase 2 — AI Fingerprint Extraction
 * Uses Claude Haiku to parse a candidate's raw profile into structured fields:
 * domain[], seniority, skills[], years_experience
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'ANTHROPIC_API_KEY_NOT_SET',
})

export interface CandidateFingerprint {
  domain: string[]
  seniority: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | null
  skills: string[]
  years_experience: number | null
  summary: string
}

const VALID_DOMAINS = [
  'frontend', 'backend', 'fullstack', 'mobile', 'data_ml',
  'devops', 'design', 'product', 'marketing', 'sales',
  'salesforce', 'security',
]

const VALID_SENIORITIES = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal']

export function buildProfileText(candidate: {
  full_name: string
  current_title?: string | null
  current_company?: string | null
  skills?: string[]
  domain?: string[]
  seniority?: string | null
  years_experience?: number | null
  notes?: string | null
  raw_data?: Record<string, unknown> | null
}): string {
  const parts: string[] = []

  parts.push(`Name: ${candidate.full_name}`)
  if (candidate.current_title) parts.push(`Title: ${candidate.current_title}`)
  if (candidate.current_company) parts.push(`Company: ${candidate.current_company}`)
  if (candidate.years_experience) parts.push(`Years of experience: ${candidate.years_experience}`)
  if (candidate.skills?.length) parts.push(`Skills: ${candidate.skills.join(', ')}`)
  if (candidate.domain?.length) parts.push(`Domains (self-tagged): ${candidate.domain.join(', ')}`)
  if (candidate.seniority) parts.push(`Seniority (self-tagged): ${candidate.seniority}`)
  if (candidate.notes) parts.push(`Notes: ${candidate.notes}`)

  // Include relevant raw_data fields if present (from CSV or extension)
  if (candidate.raw_data && typeof candidate.raw_data === 'object') {
    const raw = candidate.raw_data as Record<string, unknown>
    const extras = ['headline', 'summary', 'about', 'experience', 'education', 'bio']
    for (const key of extras) {
      if (raw[key] && typeof raw[key] === 'string') {
        parts.push(`${key}: ${raw[key]}`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Call Claude Haiku to extract a structured fingerprint from profile text.
 */
export async function extractFingerprint(profileText: string): Promise<CandidateFingerprint> {
  const systemPrompt = `You are a talent intelligence engine. Your job is to analyse a candidate profile and extract structured data.

Valid domains: ${VALID_DOMAINS.join(', ')}
Valid seniority levels: ${VALID_SENIORITIES.join(', ')}

Rules:
- domain: array of 1-3 domains from the valid list that best match the candidate's expertise
- seniority: one value from the valid list. Use title + years to infer. Null if completely unclear.
- skills: array of specific technical skills mentioned or strongly implied. Lowercase, no punctuation. Max 20.
- years_experience: integer best estimate of total professional years. Null if not determinable.
- summary: one sentence (max 20 words) describing the candidate's profile.

Respond ONLY with valid JSON matching this shape:
{
  "domain": ["backend", "devops"],
  "seniority": "senior",
  "skills": ["python", "kubernetes", "aws", "postgres"],
  "years_experience": 6,
  "summary": "Senior backend engineer with 6 years in Python, Kubernetes, and cloud infrastructure."
}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [
      { role: 'user', content: `Extract fingerprint from this candidate profile:\n\n${profileText}` },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown code fences if present
  const jsonStr = raw.replace(/```json\n߀�▹/g, '').replace(/```\n?/g, '').trim()

  let parsed: CandidateFingerprint
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Haiku returned non-JSON: ${raw.slice(0, 200)}`)
  }

  // Validate and sanitise
  return {
    domain: (parsed.domain ?? []).filter((d: string) => VALID_DOMAINS.includes(d)),
    seniority: VALID_SENIORITIES.includes(parsed.seniority ?? '')
      ? (parsed.seniority as CandidateFingerprint['seniority'])
      : null,
    skills: (parsed.skills ?? []).slice(0, 20).map((s: string) => String(s).toLowerCase().trim()),
    years_experience: typeof parsed.years_experience === 'number' ? parsed.years_experience : null,
    summary: String(parsed.summary ?? '').slice(0, 200),
  }
}
