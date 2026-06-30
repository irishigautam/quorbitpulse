/**
 * s3 — Job enrichment pipeline.
 * Takes a raw job description and extracts structured fingerprint fields:
 * skills[], domain[], seniority, min_experience.
 * Uses Claude Haiku for extraction (same model as candidate fingerprinting).
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SeniorityLevel } from '@/types'

const client = new Anthropic()

export interface JobFingerprint {
  skills: string[]
  domain: string[]
  seniority: SeniorityLevel | null
  min_experience: number | null
  remote: boolean
}

export async function enrichJob(title: string, description: string): Promise<JobFingerprint> {
  const prompt = `Extract a structured fingerprint from this job posting.

Title: ${title}
Description: ${description.slice(0, 3000)}

Return a JSON object:
{
  "skills": string[],        // max 15 technical skills/tools required
  "domain": string[],        // max 3 business domains (e.g. "fintech", "saas", "ecommerce")
  "seniority": "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | null,
  "min_experience": number or null,  // minimum years of experience required
  "remote": boolean
}

Return ONLY valid JSON.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as any).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.replace(/```(?:json)?\n?/g, '').trim() : raw

  try {
    return JSON.parse(jsonStr) as JobFingerprint
  } catch {
    return { skills: [], domain: [], seniority: null, min_experience: null, remote: false }
  }
}

/** Batch enrich multiple job descriptions (rate-limited to avoid Haiku throttling) */
export async function enrichJobsBatch(
  jobs: Array<{ title: string; description: string }>
): Promise<JobFingerprint[]> {
  const results: JobFingerprint[] = []
  for (const job of jobs) {
    try {
      results.push(await enrichJob(job.title, job.description))
    } catch {
      results.push({ skills: [], domain: [], seniority: null, min_experience: null, remote: false })
    }
    // Small delay to respect Haiku rate limits
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}
