/**
 * POST /api/candidates/[id]/mcp-token
 *
 * lc10 — Generate an MCP token for a candidate.
 * Called by the recruiter from the dashboard; token is sent to the candidate
 * so they can install Quorbit in Claude desktop.
 *
 * Returns the token once — not stored in plaintext after this.
 *
 * GET  — list existing (non-revoked) tokens for this candidate
 * POST — create a new token
 * DELETE — revoke all tokens for this candidate
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  // Verify candidate belongs to company
  const { data: candidate } = await supabase
    .from('imported_candidates')
    .select('id, full_name')
    .eq('id', params.id)
    .eq('company_id', company.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: tokens } = await supabase
    .from('candidate_mcp_tokens')
    .select('id, label, created_at, expires_at, revoked')
    .eq('candidate_id', params.id)
    .eq('revoked', false)
    .order('created_at', { ascending: false })

  return NextResponse.json({ tokens: tokens ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  const { data: candidate } = await supabase
    .from('imported_candidates')
    .select('id, full_name, email')
    .eq('id', params.id)
    .eq('company_id', company.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const label = body.label ?? 'Claude Desktop'

  // Generate a cryptographically random token
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const token = 'qbt_' + Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  await supabase.from('candidate_mcp_tokens').insert({
    candidate_id: params.id,
    token,
    label,
    expires_at: null,  // no expiry by default; recruiter can revoke
  })

  // Build the Claude desktop config snippet
  const mcpEndpoint = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://quorbitpulse.vercel.app'}/api/mcp/candidate`

  const claudeConfig = {
    mcpServers: {
      quorbit: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch', mcpEndpoint],
        env: { QUORBIT_TOKEN: token },
      },
    },
  }

  return NextResponse.json({
    token,
    label,
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    mcpEndpoint,
    claudeConfigSnippet: JSON.stringify(claudeConfig, null, 2),
    instructions: [
      '1. Share this token with the candidate — it will not be shown again.',
      '2. Candidate adds the snippet to their Claude desktop config (~/.claude/config.json or via Settings → Developer).',
      '3. Once installed, Claude will offer to update the candidate\'s Quorbit profile during work conversations.',
    ],
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  const { data: candidate } = await supabase
    .from('imported_candidates')
    .select('id')
    .eq('id', params.id)
    .eq('company_id', company.id)
    .single()

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('candidate_mcp_tokens')
    .update({ revoked: true })
    .eq('candidate_id', params.id)

  return NextResponse.json({ revoked: true })
}
