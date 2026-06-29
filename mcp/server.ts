import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'

async function fetchAPI(path: string) {
  const res = await fetch(`${BASE_URL}/api/v1${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

const tools: Tool[] = [
  {
    name: 'search_jobs',
    description: 'Search for open job positions on JobPulse — a free, open job registry',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords to search (title, description)' },
        location: { type: 'string', description: 'City or region' },
        remote: { type: 'boolean', description: 'Remote-friendly jobs only' },
        job_type: {
          type: 'string',
          enum: ['full_time', 'part_time', 'contract', 'internship', 'freelance'],
          description: 'Employment type',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required skills (e.g. ["React", "TypeScript"])',
        },
        limit: { type: 'number', description: 'Max results (default 10, max 50)', default: 10 },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get full details of a specific job posting by ID',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Job UUID' },
      },
    },
  },
  {
    name: 'list_companies',
    description: 'List companies actively hiring on JobPulse',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20)', default: 20 },
      },
    },
  },
  {
    name: 'get_company_jobs',
    description: 'Get all open jobs at a specific company by name',
    inputSchema: {
      type: 'object',
      required: ['company_name'],
      properties: {
        company_name: { type: 'string', description: 'Company name to search for' },
      },
    },
  },
]

async function handleSearchJobs(args: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (args.query) params.set('q', String(args.query))
  if (args.location) params.set('location', String(args.location))
  if (args.remote) params.set('remote', 'true')
  if (args.job_type) params.set('type', String(args.job_type))
  if (Array.isArray(args.skills) && args.skills.length > 0) {
    params.set('skills', args.skills.join(','))
  }
  const limit = Math.min(Number(args.limit ?? 10), 50)
  params.set('limit', String(limit))

  const data = await fetchAPI(`/jobs?${params}`)
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total: data.total,
        jobs: data.data?.map((j: Record<string, unknown>) => ({
          id: j.id,
          title: j.title,
          company: (j.company as Record<string, unknown>)?.name,
          location: j.location,
          remote: j.remote,
          job_type: j.job_type,
          skills: j.skills,
          salary_min: j.salary_min,
          salary_max: j.salary_max,
          salary_currency: j.salary_currency,
          posted_at: j.posted_at,
          apply_url: j.apply_url,
          apply_email: j.apply_email,
        })),
      }, null, 2),
    }],
  }
}

async function handleGetJob(args: Record<string, unknown>) {
  const data = await fetchAPI(`/jobs/${args.id}`)
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

async function handleListCompanies(args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit ?? 20), 100)
  const data = await fetchAPI(`/companies?limit=${limit}`)
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

async function handleGetCompanyJobs(args: Record<string, unknown>) {
  // First search for the company by name
  const companiesData = await fetchAPI('/companies?limit=100')
  const companies: Record<string, unknown>[] = companiesData.data ?? []
  const match = companies.find(
    (c: Record<string, unknown>) => String(c.name).toLowerCase().includes(String(args.company_name).toLowerCase())
  )

  if (!match) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: `No company found matching "${args.company_name}"` }),
      }],
    }
  }

  const data = await fetchAPI(`/companies/${match.id}/jobs`)
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

async function main() {
  const server = new Server(
    { name: 'jobpulse', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const a = (args ?? {}) as Record<string, unknown>

    switch (name) {
      case 'search_jobs': return handleSearchJobs(a)
      case 'get_job': return handleGetJob(a)
      case 'list_companies': return handleListCompanies(a)
      case 'get_company_jobs': return handleGetCompanyJobs(a)
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('JobPulse MCP server running on stdio')
}

main().catch(console.error)
