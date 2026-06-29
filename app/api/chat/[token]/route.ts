/**
 * POST /api/chat/[token]
 *
 * Public, unauthenticated endpoint for the candidate chat session.
 * Validates the HMAC-signed token, runs a Claude Haiku response,
 * appends to the transcript, and returns the AI's reply.
 *
 * Body: { message: string }
 * Returns: { reply: string, turn: number, finished: boolean, readiness_score?: number }
 *
 * Rate-limited per token (60 messages/hour).
 * Session is marked 'completed' after the final question is answered.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyChatToken } from '@/lib/chat/token'
import { sanitizeText, detectPromptInjection } from '@/lib/security/sanitize'
import { LIMITS } from '@/lib/security/rate-limit'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'ANTHROPIC_API_KEY_NOT_SET',
})

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TURNS = 7 // 1 opener + 5 questions + 1 closing

// The fixed conversation script — Haiku follows this but adapts naturally
const SYSTEM_PROMPT = `You are a friendly, professional recruiter assistant conducting a structured readiness conversation with a job candidate. Your goal is to assess their fit and readiness in a warm, concise way. Follow this flow:

1. **Opening**: Greet the candidate, mention the role they applied for (provided in context), and set expectations (5-min conversation, 6 short questions).
2. **Questions** (ask one at a time, wait for each answer before proceeding):
   - Q1: "Can you tell me a little about your current or most recent role?"
   - Q2: "What draws you to [job title] specifically?"
   - Q3: "What's a technical challenge you've solved recently that you're proud of?"
   - Q4: "How do you typically approach learning a new tool or technology quickly?"
   - Q5: "What does your ideal team environment look like?"
   - Q6: "Are you open to discussing compensation range? If yes, what are you targeting?"
3. **Closing**: Thank them, give a readiness score (0–100) hidden in your final message using this EXACT format on a new line at the very end: READINESS_SCORE:[number]

Rules:
- Be warm but efficient. Keep your messages under 100 words each.
- Never reveal that you are an AI running a script — be natural and conversational.
- If the candidate goes off-topic, politely redirect.
- Never discuss salary or compensation in detail beyond Q6.
- If the candidate says anything inappropriate, politely close the conversation.
- The READINESS_SCORE line must appear ONLY in your final closing message.`

interface TranscriptEntry {
  role: 'assistant' | 'user'
  content: string
  ts: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    // 1. Verify HMAC token
    const payload = verifyChatToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired chat link. Please request a new one.' },
        { status: 401 },
      )
    }

    // 2. Rate limit by token (60 messages/hour per session)
    const rl = LIMITS.chat(token.slice(0, 32)) // use first 32 chars as key (avoid storing full token)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
      )
    }

    // 3. Parse and sanitize incoming message
    const body = await req.json()
    const rawMessage = body.message ?? ''
    const message = sanitizeText(rawMessage, 1000)

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // 4. Detect prompt injection
    if (detectPromptInjection(rawMessage)) {
      // Return a safe response without revealing we detected it
      return NextResponse.json({
        reply: "I'm here to help with your job application. Could you tell me more about your background?",
        turn: 0,
        finished: false,
      })
    }

    const supabase = createServiceClient()

    // 5. Load session from DB
    const { data: session, error: sessionErr } = await supabase
      .from('chat_sessions')
      .select('id, status, transcript, company_id, candidate_id, job_id')
      .eq('id', payload.sessionId)
      .eq('company_id', payload.companyId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'This conversation has already been completed.', finished: true },
        { status: 410 },
      )
    }

    if (session.status === 'expired') {
      return NextResponse.json(
        { error: 'This chat link has expired.', finished: true },
        { status: 410 },
      )
    }

    // 6. Load job context for the system prompt
    const { data: job } = await supabase
      .from('jobs')
      .select('title, domain')
      .eq('id', payload.jobId)
      .single()

    const jobTitle = job?.title ?? 'the role'

    // 7. Build conversation history for Claude
    const transcript: TranscriptEntry[] = Array.isArray(session.transcript) ? session.transcript : []
    const turnNumber = transcript.filter(t => t.role === 'user').length + 1

    // Convert transcript to Anthropic message format
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const entry of transcript) {
      messages.push({ role: entry.role, content: entry.content })
    }
    // Add new user message
    messages.push({ role: 'user', content: message })

    // 8. Call Claude Haiku
    const systemWithContext = `${SYSTEM_PROMPT}\n\nContext: The candidate is applying for the role: "${jobTitle}".`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: systemWithContext,
      messages,
    })

    const replyRaw = response.content[0].type === 'text' ? response.content[0].text : ''

    // 9. Extract readiness score if present (final message pattern)
    let readinessScore: number | undefined
    let replyClean = replyRaw

    const scoreMatch = replyRaw.match(/READINESS_SCORE:(\d+)/i)
    if (scoreMatch) {
      readinessScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
      replyClean = replyRaw.replace(/\nREADINESS_SCORE:\d+/i, '').trim()
    }

    // 10. Append to transcript
    const now = new Date().toISOString()
    const newTranscript: TranscriptEntry[] = [
      ...transcript,
      { role: 'user', content: message, ts: now },
      { role: 'assistant', content: replyClean, ts: now },
    ]

    const isFinished = !!readinessScore || turnNumber >= MAX_TURNS

    // 11. Update session in DB
    const updatePayload: Record<string, unknown> = {
      transcript: newTranscript,
      status: isFinished ? 'completed' : 'active',
    }
    if (readinessScore !== undefined) {
      updatePayload.readiness_score = readinessScore
    }

    await supabase
      .from('chat_sessions')
      .update(updatePayload)
      .eq('id', session.id)

    // 12. If completed, update candidate row with readiness_score
    if (isFinished && readinessScore !== undefined) {
      await supabase
        .from('imported_candidates')
        .update({ status: 'chat_complete' })
        .eq('id', payload.candidateId)
    }

    return NextResponse.json({
      reply: replyClean,
      turn: turnNumber,
      finished: isFinished,
      ...(readinessScore !== undefined && { readiness_score: readinessScore }),
    })
  } catch (err) {
    console.error('chat route error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

/**
 * GET /api/chat/[token]
 *
 * Returns the current session state (transcript, status).
 * Used by the chat UI on page load to restore any prior conversation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    const payload = verifyChatToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired chat link.' },
        { status: 401 },
      )
    }

    const supabase = createServiceClient()

    const { data: session } = await supabase
      .from('chat_sessions')
      .select('id, status, transcript, readiness_score, expires_at')
      .eq('id', payload.sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('title')
      .eq('id', payload.jobId)
      .single()

    return NextResponse.json({
      session_id: session.id,
      status: session.status,
      transcript: session.transcript,
      readiness_score: session.readiness_score,
      expires_at: session.expires_at,
      job_title: job?.title ?? null,
    })
  } catch (err) {
    console.error('chat GET error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
