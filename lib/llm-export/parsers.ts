/**
 * LLM Export Parsers — lc8
 *
 * Supports:
 *   - ChatGPT export format (conversations.json from takeout)
 *   - Claude export format (claude_conversations.json from settings)
 *
 * Output: normalised ConversationSnippet[] for privacy classification
 */

import type { ConversationSnippet } from './privacy-classifier'

// ─── ChatGPT Export Types ────────────────────────────────────────────────────

interface GptMessage {
  id: string
  author: { role: 'user' | 'assistant' | 'system' | 'tool' }
  content: {
    content_type: string
    parts?: Array<string | null>
  }
  create_time: number | null
}

interface GptConversation {
  id: string
  title: string
  create_time: number
  mapping: Record<string, { message: GptMessage | null; children: string[] }>
}

// ─── Claude Export Types ─────────────────────────────────────────────────────

interface ClaudeMessage {
  uuid: string
  sender: 'human' | 'assistant'
  text: string
  created_at: string
}

interface ClaudeConversation {
  uuid: string
  name: string
  created_at: string
  chat_messages: ClaudeMessage[]
}

// ─── Normalised output ───────────────────────────────────────────────────────

export type ExportFormat = 'chatgpt' | 'claude' | 'unknown'

export interface ParseResult {
  format: ExportFormat
  totalConversations: number
  snippets: ConversationSnippet[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, maxChars = 800): string {
  return text.length > maxChars ? text.slice(0, maxChars) + '…' : text
}

function extractGptUserText(conv: GptConversation): string {
  const msgs = Object.values(conv.mapping)
    .map(n => n.message)
    .filter((m): m is GptMessage => !!m && m.author.role === 'user')
    .sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0))

  return msgs
    .map(m => m.content.parts?.filter(Boolean).join(' ') ?? '')
    .filter(Boolean)
    .join(' ')
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

export function parseChatGptExport(raw: unknown): ParseResult {
  if (!Array.isArray(raw)) throw new Error('ChatGPT export must be a JSON array')

  const conversations = raw as GptConversation[]
  const snippets: ConversationSnippet[] = []

  conversations.forEach((conv, idx) => {
    if (!conv.mapping) return
    const userText = extractGptUserText(conv)
    if (userText.length < 50) return  // too short to classify

    snippets.push({
      index: idx,
      title: conv.title ?? `Conversation ${idx + 1}`,
      snippet: truncate(userText),
    })
  })

  return { format: 'chatgpt', totalConversations: conversations.length, snippets }
}

export function parseClaudeExport(raw: unknown): ParseResult {
  if (!Array.isArray(raw)) throw new Error('Claude export must be a JSON array')

  const conversations = raw as ClaudeConversation[]
  const snippets: ConversationSnippet[] = []

  conversations.forEach((conv, idx) => {
    const humanMsgs = (conv.chat_messages ?? [])
      .filter(m => m.sender === 'human')
      .map(m => m.text)
      .filter(Boolean)

    const userText = humanMsgs.join(' ')
    if (userText.length < 50) return

    snippets.push({
      index: idx,
      title: conv.name ?? `Conversation ${idx + 1}`,
      snippet: truncate(userText),
    })
  })

  return { format: 'claude', totalConversations: conversations.length, snippets }
}

/**
 * Auto-detect format and parse. Throws if unrecognised.
 */
export function parseExport(raw: unknown): ParseResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Export must be a non-empty JSON array')
  }

  const first = raw[0]

  // ChatGPT: has `mapping` field
  if (first && typeof first === 'object' && 'mapping' in first) {
    return parseChatGptExport(raw)
  }

  // Claude: has `chat_messages` field
  if (first && typeof first === 'object' && 'chat_messages' in first) {
    return parseClaudeExport(raw)
  }

  return { format: 'unknown', totalConversations: 0, snippets: [] }
}
