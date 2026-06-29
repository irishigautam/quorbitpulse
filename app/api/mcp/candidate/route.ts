/**
 * POST /api/mcp/candidate
 *
 * lc10 — Quorbit MCP endpoint for candidates.
 *
 * Candidates install Quorbit as an MCP tool in Claude desktop.
 * When they work on technical problems, Claude can call this endpoint
 * to propose profile updates. The candidate approves each update
 * explicitly before it's saved (via the `preview` tool call pattern).
 *
 * Auth: Bearer token = candidate MCP token (separate from chat tokens)
 * Stored in: candidate_mcp_tokens table
 *
 * Tools exposed via MCP manifest:
 *   - get_profile      → returns current candidate profile summary
 *   - propose_update   → previews a signal update for candidate approval
 *   - commit_update    → saves an approved update (requires approval_token)
 *
 * This route handles the MCP JSON-RPC 2.0 protocol directly.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function authenticateCandidate(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('candidate_mcp_tokens')
    .select('candidate_id, expires_at, revoked')
    .eq('token', token)
    .single()

  if (!data || data.revoked) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null

  return data.candidate_id as string
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function handleGetProfile(candidateId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('imported_candidates')
    .select('full_name, current_title, current_company, skills, domain, seniority, years_experience, llm_export_processed_at')
    .eq('id', candidateId)
    .single()

  if (error || !data) return { error: 'Profile not found' }

  return {
    name: data.full_name,
    current_title: data.current_title,
    current_company: data.current_company,
    skills: data.skills ?? [],
    domain: data.domain ?? [],
    seniority: data.seniority,
    years_experience: data.years_experience,
    llm_enriched: !!data.llm_export_processed_at,
  }
}

async function handleProposeUpdate(
  candidateId: string,
  args: { skills?: string[]; domain?: string[]; years_experience?: number; summary?: string; source_context?: string },
) {
  const supabase = createServiceClient()

  // Get current profile for diff
  const { data: current } = await supabase
    .from('imported_candidates')
    .select('skills, domain, years_experience')
    .eq('id', candidateId)
    .single()

  const newSkills = args.skills ?? []
  const newDomain = args.domain ?? []

  const addedSkills = newSkills.filter(s => !(current?.skills ?? []).includes(s))
  const addedDomain = newDomain.filter(d => !(current?.domain ?? []).includes(d))

  // Mint a short-lived approval token (15 min TTL)
  const approvalToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await supabase.from('mcp_pending_updates').insert({
    candidate_id: candidateId,
    approval_token: approvalToken,
    proposed_skills: newSkills,
    proposed_domain: newDomain,
    proposed_years_experience: args.years_experience ?? null,
    proposed_summary: args.summary ?? null,
    source_context: args.source_context ?? null,
    expires_at: expiresAt,
  })

  return {
    preview: {
      added_skills: addedSkills,
      added_domain: addedDomain,
      years_experience: args.years_experience ?? null,
      summary: args.summary ?? null,
    },
    approval_token: approvalToken,
    instruction: addedSkills.length + addedDomain.length > 0
      ? `Review the changes above. To save them, call commit_update with approval_token="${approvalToken}". To discard, do nothing.`
      : 'No new signals detected beyond what\'s already in your profile.',
    expires_in: '15 minutes',
  }
}

async function handleCommitUpdate(candidateId: string, args: { approval_token: string }) {
  const supabase = createServiceClient()

  const { data: pending, error } = await supabase
    .from('mcp_pending_updates')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('approval_token', args.approval_token)
    .eq('committed', false)
    .single()

  if (error || !pending) return { error: 'Invalid or expired approval token' }
  if (new Date(pending.expires_at) < new Date()) return { error: 'Approval token expired (15 min limit)' }

  // Fetch current profile
  const { data: current } = await supabase
    .from('imported_candidates')
    .select('skills, domain, years_experience')
    .eq('id', candidateId)
    .single()

  const mergedSkills = Array.from(new Set([...(current?.skills ?? []), ...(pending.proposed_skills ?? [])]))
  const mergedDomain = Array.from(new Set([...(current?.domain ?? []), ...(pending.proposed_domain ?? [])]))
  const yearsExp = pending.proposed_years_experience !== null
    ? Math.max(current?.years_experience ?? 0, pending.proposed_years_experience)
    : current?.years_experience ?? null

  await supabase
    .from('imported_candidates')
    .update({
      skills: mergedSkills,
      domain: mergedDomain,
      years_experience: yearsExp,
      llm_export_processed_at: new Date().toISOString(),
      llm_export_summary: pending.proposed_summary ?? null,
      llm_export_source: 'claude',
    })
    .eq('id', candidateId)

  await supabase
    .from('mcp_pending_updates')
    .update({ committed: true })
    .eq('approval_token', args.approval_token)

  return {
    success: true,
    updated: {
      skills: mergedSkills,
      domain: mergedDomain,
      years_experience: yearsExp,
    },
    message: 'Profile updated successfully. Your Quorbit fingerprint now reflects this conversation.',
  }
}

// ── MCP tools manifest ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_profile',
    description: 'Get the candidate\'s current Quorbit profile — skills, domain, experience level.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'propose_update',
    description: 'Propose adding work signals from this conversation to the candidate\'s Quorbit profile. Shows a preview before saving — candidate must call commit_update to confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        skills: { type: 'array', items: { type: 'string' }, description: 'New skills demonstrated in this conversation' },
        domain: { type: 'array', items: { type: 'string' }, description: 'Work domains demonstrated (e.g. frontend, backend, data)' },
        years_experience: { type: 'number', description: 'Minimum years of professional experience implied' },
        summary: { type: 'string', description: 'One-sentence summary of professional focus from this conversation' },
        source_context: { type: 'string', description: 'Brief description of what was discussed (e.g. "Designed a distributed caching system")' },
      },
      required: [],
    },
  },
  {
    name: 'commit_update',
    description: 'Save a previously proposed profile update after candidate review. Requires the approval_token from propose_update.',
    inputSchema: {
      type: 'object',
      properties: {
        approval_token: { type: 'string', description: 'Token from propose_update response' },
      },
      required: ['approval_token'],
    },
  },
]

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Handle MCP initialize (no auth needed)
  let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  const { id, method, params } = body

  // MCP lifecycle methods
  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'quorbit-candidate', version: '1.0.0' },
    })
  }

  if (method === 'tools/list') {
    return rpcResult(id, { tools: TOOLS })
  }

  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 })
  }

  // All tool calls require auth
  const candidateId = await authenticateCandidate(req)
  if (!candidateId) {
    return rpcError(id, -32001, 'Unauthorized — invalid or missing MCP token')
  }

  if (method === 'tools/call') {
    const toolName = (params?.name as string) ?? ''
    const args = (params?.arguments as Record<string, unknown>) ?? {}

    let toolResult: unknown

    if (toolName === 'get_profile') {
      toolResult = await handleGetProfile(candidateId)
    } else if (toolName === 'propose_update') {
      toolResult = await handleProposeUpdate(candidateId, args as Parameters<typeof handleProposeUpdate>[1])
    } else if (toolName === 'commit_update') {
      toolResult = await handleCommitUpdate(candidateId, args as { approval_token: string })
    } else {
      return rpcError(id, -32601, `Unknown tool: ${toolName}`)
    }

    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
    })
  }

  return rpcError(id, -32601, `Method not found: ${method}`)
}

// MCP discovery endpoint
export async function GET() {
  return NextResponse.json({
    name: 'Quorbit Candidate Profile',
    description: 'Update your Quorbit professional profile from within Claude conversations.',
    version: '1.0.0',
    protocol: 'mcp',
    endpoint: '/api/mcp/candidate',
    auth: 'Bearer <your-mcp-token>',
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
  })
}
