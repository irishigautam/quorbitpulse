/**
 * lc8 — Work Signal Extractor
 *
 * Takes work_relevant conversation snippets (post privacy classification)
 * and extracts structured signals via Claude Haiku:
 *   - skills[]           e.g. ["React", "TypeScript", "PostgreSQL"]
 *   - domain[]           e.g. ["frontend", "backend", "data"]
 *   - seniority_signals  evidence of level (e.g. "architected microservices", "led team")
 *   - years_experience   inferred min YOE (null if not determinable)
 *   - summary            1-sentence professional summary
 *
 * These signals are merged into the candidate's existing fingerprint.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ClassifiedConversation } from './privacy-classifier'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ExtractedSignals {
  skills: string[]
  domain: string[]
  seniorityEvidence: string[]   // raw phrases, not normalised
  yearsExperience: number | null
  summary: string
  conversationsAnalysed: number
}

const EXTRACT_SYSTEM = `You extract professional work signals from LLM conversation snippets.

Given a list of work-relevant conversation snippets from someone's LLM chat history, extract:
- skills: specific technical/professional skills demonstrated (deduplicated, proper casing)
- domain: broad domain categories from this list only: ["frontend","backend","fullstack","mobile","data","ml","devops","cloud","security","design","product","management","finance","legal","marketing","other"]
- seniority_evidence: short phrases (3–8 words) that reveal experience level, e.g. "owns prod infrastructure", "designed distributed system", "mentored junior engineers"
- years_experience: minimum years of professional experience implied (integer or null)
- summary: one sentence (max 20 words) describing professional focus

Respond ONLY with JSON: { "skills": [], "domain": [], "seniority_evidence": [], "years_experience": null|number, "summary": "" }
Do not include personal information. Do not infer things not evidenced in the text.`

export async function extractSignals(
  workConversations: ClassifiedConversation[],
  /** Original snippets keyed by index, for full text */
  snippetMap: Record<number, string>,
): Promise<ExtractedSignals> {
  if (workConversations.length === 0) {
    return { skills: [], domain: [], seniorityEvidence: [], yearsExperience: null, summary: '', conversationsAnalysed: 0 }
  }

  // Build input: title + snippet for each work-relevant conversation
  // Limit to first 30 to control token cost
  const relevant = workConversations.slice(0, 30)
  const userContent = relevant
    .map(c => `[${c.workSummary ?? c.title}]\n${snippetMap[c.index] ?? ''}`)
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

  let parsed: {
    skills?: string[]
    domain?: string[]
    seniority_evidence?: string[]
    years_experience?: number | null
    summary?: string
  } = {}

  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  }

  return {
    skills: parsed.skills ?? [],
    domain: parsed.domain ?? [],
    seniorityEvidence: parsed.seniority_evidence ?? [],
    yearsExperience: parsed.years_experience ?? null,
    summary: parsed.summary ?? '',
    conversationsAnalysed: relevant.length,
  }
}

/**
 * Merge extracted signals into existing candidate fingerprint data.
 * Deduplicates skills and domain arrays.
 */
export function mergeSignals(
  existing: { skills: string[]; domain: string[]; years_experience: number | null },
  extracted: ExtractedSignals,
): { skills: string[]; domain: string[]; years_experience: number | null } {
  const mergedSkills = Array.from(new Set([
    ...existing.skills,
    ...extracted.skills,
  ]))

  const mergedDomain = Array.from(new Set([
    ...existing.domain,
    ...extracted.domain,
  ]))

  // Take the higher YOE estimate
  const yearsExperience = existing.years_experience !== null && extracted.yearsExperience !== null
    ? Math.max(existing.years_experience, extracted.yearsExperience)
    : existing.years_experience ?? extracted.yearsExperience

  return { skills: mergedSkills, domain: mergedDomain, years_experience: yearsExperience }
}
