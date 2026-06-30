/**
 * Resume parser — extracts fingerprint from a PDF or plain-text resume.
 * Sends the document to Claude Haiku as a base64-encoded PDF document block.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface ResumeFingerprint {
  full_name: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  skills: string[]
  domain: string[]
  seniority: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | null
  years_experience: number | null
  education: { degree: string; institution: string; year: number | null }[]
  summary: string
}

const client = new Anthropic()

export async function parseResume(pdfBuffer: Buffer): Promise<ResumeFingerprint> {
  const base64Pdf = pdfBuffer.toString('base64')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          } as any,
          {
            type: 'text',
            text: `Extract a structured fingerprint from this resume. Return a JSON object with these fields:
{
  "full_name": string or null,
  "current_title": string or null,
  "current_company": string or null,
  "location": string or null,
  "skills": string[],          // technical skills, tools, languages, frameworks
  "domain": string[],          // business domains (e.g. "fintech", "saas", "edtech", "healthcare")
  "seniority": "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | null,
  "years_experience": number or null,
  "education": [{ "degree": string, "institution": string, "year": number or null }],
  "summary": string            // 2-3 sentence professional summary
}

Rules:
- skills: max 20 items, technical only (no soft skills)
- domain: max 5 items
- seniority: infer from title and years of experience
- years_experience: total professional years, integer
- Return ONLY valid JSON, no markdown`
          }
        ],
      }
    ],
  })

  const raw = (message.content[0] as any).text.trim()
  // Strip markdown if present
  const jsonStr = raw.startsWith('```') ? raw.replace(/```(?:json)?\n?/g, '').trim() : raw

  try {
    return JSON.parse(jsonStr) as ResumeFingerprint
  } catch {
    // Fallback if JSON is malformed
    return {
      full_name: null, current_title: null, current_company: null, location: null,
      skills: [], domain: [], seniority: null, years_experience: null,
      education: [], summary: 'Could not parse resume.'
    }
  }
}
