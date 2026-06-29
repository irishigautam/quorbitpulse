/**
 * lc9 — Privacy Classifier for LLM Export Parsing
 *
 * Classifies each conversation from a ChatGPT/Claude export into:
 *   - work_relevant: code, system design, strategy, analysis, product, technical problems
 *   - personal:      health, relationships, emotions, personal advice, legal/financial personal matters
 *   - neutral:       general knowledge, trivia, factual Q&A not tied to work
 *   - skip:          too short, system messages, gibberish
 *
 * Only `work_relevant` conversations are passed to signal extraction.
 * Personal content is NEVER stored or processed further.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type PrivacyClass = 'work_relevant' | 'personal' | 'neutral' | 'skip'

export interface ClassifiedConversation {
  index: number
  title: string
  privacyClass: PrivacyClass
  confidence: number       // 0–1
  workSummary?: string     // only present for work_relevant
}

export interface ConversationSnippet {
  index: number
  title: string
  /** First ~800 chars of concatenated user messages — enough to classify without full context */
  snippet: string
}

const SYSTEM_PROMPT = `You are a privacy-preserving classifier for professional profile enrichment.

Your job: classify each conversation snippet into exactly one category:
- work_relevant: Technical problem-solving, code review, system design, architecture, data analysis, product strategy, business strategy, writing/editing professional content, debugging, API/library questions, career strategy
- personal: Health/medical, relationships, emotions, therapy-like discussions, personal finances, legal personal matters, family issues, religious/spiritual topics
- neutral: General knowledge lookups, trivia, recipes, travel info, entertainment — not personal, not work
- skip: Too short to classify (<3 meaningful exchanges), system/admin messages, test inputs, gibberish

Rules:
- When in doubt between work_relevant and neutral, choose neutral (conservative)
- When in doubt involving personal, always choose personal (protect privacy)
- A conversation about "how to negotiate salary" is work_relevant
- A conversation about "I'm feeling anxious about my job" is personal
- A conversation about "how does React work" is work_relevant

Respond with a JSON array. Each element: { "index": <number>, "class": "<category>", "confidence": <0.0–1.0>, "summary": "<10-word work summary if work_relevant, else null>" }
Only respond with the JSON array, no prose.`

/**
 * Classify up to 20 conversation snippets in a single Haiku call.
 * Batching keeps costs low.
 */
export async function classifyConversations(
  snippets: ConversationSnippet[],
): Promise<ClassifiedConversation[]> {
  if (snippets.length === 0) return []

  const userContent = snippets
    .map(s => `[${s.index}] "${s.title}"\n${s.snippet}`)
    .join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  let parsed: Array<{ index: number; class: string; confidence: number; summary: string | null }> = []
  try {
    parsed = JSON.parse(text)
  } catch {
    // If Haiku adds prose, try to extract JSON array
    const match = text.match(/\[[\s\S]*\]/)
    if (match) parsed = JSON.parse(match[0])
  }

  return parsed.map(r => ({
    index: r.index,
    title: snippets.find(s => s.index === r.index)?.title ?? '',
    privacyClass: (r.class as PrivacyClass) ?? 'skip',
    confidence: r.confidence ?? 0.5,
    workSummary: r.summary ?? undefined,
  }))
}

/**
 * Run classification in batches of 20 to stay within context limits.
 */
export async function classifyAllConversations(
  snippets: ConversationSnippet[],
): Promise<ClassifiedConversation[]> {
  const BATCH_SIZE = 20
  const results: ClassifiedConversation[] = []

  for (let i = 0; i < snippets.length; i += BATCH_SIZE) {
    const batch = snippets.slice(i, i + BATCH_SIZE)
    const classified = await classifyConversations(batch)
    results.push(...classified)
  }

  return results
}
