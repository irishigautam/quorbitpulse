/**
 * JobPulse MCP Server — HTTP endpoint
 * Handles MCP protocol requests via HTTP (for Claude Desktop / web clients)
 *
 * Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "jobpulse": {
 *       "command": "npx",
 *       "args": ["-y", "mcp-remote", "https://jobpulse.io/api/mcp"]
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'

async function fetchJobsAPI(path: string) {
  const res = await fetch(`${BASE_URL}/api/v1${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

const TOOLS = [
  {
    name: 'search_jobs',
    description: 'Search for open job positions on JobPulse — a free, open job registry. No auth required.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search' },
        location: { type: 'string', description: 'City or region' },
        remote: { type: 'boolean', description: 'Remote-friendly jobs only' },
        job_type: { type: 'string', enum: ['full_time', 'part_time', 'contract', 'internship', 'freelance'] },
        skills: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get full details of a specific job posting',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', description: 'Job UUID' } },
    },
  },
  {
    name: 'list_companies',
    description: 'List companies actively hiring on JobPulse',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', default: 20 } },
    },
  },
  {
    name: 'get_company_jobs',
    description: 'Get all open jobs at a specific company',
    inputSchema: {
      type: 'object',
      required: ['company_name'],
      properties: { company_name: { type: 'string' } },
    },
  },
]

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'search_jobs': {
      const params = new URLSearchParams()
      if (args.query) params.set('q', String(args.query))
      if (args.location) params.set('location', String(args.location))
      if (args.remote) params.set('remote', 'true')
      if (args.job_type) params.set('type', String(args.job_type))
      if (Array.isArray(args.skills)) params.set('skills', args.skills.join(','))
      params.set('limit', String(Math.min(Number(args.limit ?? 10), 50)))
      const data = await fetchJobsAPI(`/jobs?${params}`)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
    case 'get_job': {
      const data = await fetchJobsAPI(`/jobs/${args.id}`)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
    case 'list_companies': {
      const data = await fetchJobsAPI(`/companies?limit=${Math.min(Number(args.limit ?? 20), 100)}`)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
    case 'get_company_jobs': {
      const companies = await fetchJobsAPI('/companies?limit=100')
      const match = companies.data?.find(
        (c: { name: string }) => c.name.toLowerCase().includes(String(args.company_name).toLowerCase())
      )
      if (!match) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Company not found' }) }], isError: true }
      const data = await fetchJobsAPI(`/companies/${match.id}/jobs`)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { method, params, id } = body

  const respond = (result: unknown) =>
    NextResponse.json({ jsonrpc: '2.0', id, result }, {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  const respondError = (code: number, message: string) =>
    NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  switch (method) {
    case 'initialize':
      return respond({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'jobpulse', version: '1.0.0' },
        capabilities: { tools: {} },
      })
    case 'tools/list':
      return respond({ tools: TOOLS })
    case 'tools/call': {
      try {
        const result = await callTool(params.name, params.arguments ?? {})
        return respond(result)
      } catch (err) {
        return respondError(-32000, err instanceof Error ? err.message : 'Tool error')
      }
    }
    default:
      return respondError(-32601, `Method not found: ${method}`)
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'JobPulse MCP Server',
    version: '1.0.0',
    description: 'MCP server for JobPulse — search jobs, get job details, list companies.',
    tools: TOOLS.map(t => t.name),
    docs: `${BASE_URL}/api-docs`,
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
