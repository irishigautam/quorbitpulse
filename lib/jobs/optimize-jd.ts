/**
 * AI Job Description optimizer.
 *
 * The "AI Job Enhancement" step in the employer flow previously only meant
 * a rule-based domain/seniority tag suggester (lib in app/api/jobs/suggest-domain) —
 * no LLM ever touched the actual description text. This adds a real Claude
 * Haiku call that rewrites/expands the draft into a clearer, better-structured
 * posting, shown to the employer as an editable suggestion (never applied
 * silently).
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'ANTHROPIC_API_KEY_NOT_SET',
})

export interface OptimizeJdInput {
  title: string
  description: string // HTML from the rich text editor
  job_type: string
  location: string
  remote: boolean
  min_experience: number
  skills: string[]
}

export async function optimizeJobDescription(input: OptimizeJdInput): Promise<string> {
  const plainDescription = input.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  const systemPrompt = `You are an expert technical recruiter and copywriter. Rewrite and improve draft job descriptions to be clear, well-structured, and attractive to strong candidates — without inventing requirements, benefits, or facts not implied by the draft.

Rules:
- Preserve every real requirement/fact from the draft. Do not invent salary, benefits, or company facts not present.
- Improve structure: add clear sections if missing (e.g. About the role, Responsibilities, Requirements, Nice to have) using only these HTML tags: <h3>, <p>, <ul>, <li>, <strong>, <em>. No other tags, no markdown, no code fences.
- Fix grammar and vague language. Keep it concise — do not pad with filler.
- If the draft is already well-structured, make light improvements rather than a full rewrite.
- Respond with ONLY the improved HTML description, nothing else — no preamble, no explanation.`

  const userPrompt = `Job title: ${input.title}
Location: ${input.location}${input.remote ? ' (Remote OK)' : ''}
Type: ${input.job_type}
Minimum experience: ${input.min_experience} years
Listed skills: ${input.skills.join(', ') || 'none listed'}

Draft description:
${plainDescription || '(empty — write a reasonable draft from the title, type, location, and skills above)'}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  return raw.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim()
}
