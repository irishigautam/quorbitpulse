import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Docs — JobPulse',
  description: 'Free, open, read-only job data API. No authentication required.',
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px', margin: '12px 0', overflowX: 'auto', fontSize: '0.8125rem', lineHeight: 1.7, color: '#ABB2BF', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
      <code>{children}</code>
    </pre>
  )
}

function Badge({ method }: { method: 'GET' | 'POST' }) {
  const colors = { GET: '#16A34A', POST: '#2563EB' }
  return (
    <span style={{ background: colors[method], color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'ui-monospace, monospace', marginRight: '8px' }}>
      {method}
    </span>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ paddingTop: '48px', paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Endpoint({ method, path, description, params, example, response }: {
  method: 'GET' | 'POST'
  path: string
  description: string
  params?: { name: string; type: string; description: string }[]
  example: string
  response: string
}) {
  return (
    <div style={{ marginBottom: '40px' }}>
      <div style={{ marginBottom: '8px' }}>
        <Badge method={method} />
        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.9375rem', color: '#E5E7EB' }}>{path}</code>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '16px', fontSize: '0.9375rem' }}>{description}</p>

      {params && params.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Parameters</p>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            {params.map((p, i) => (
              <div key={p.name} style={{ padding: '10px 16px', borderBottom: i < params.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', gap: '12px', alignItems: 'start', fontSize: '0.875rem' }}>
                <code style={{ color: '#93C5FD', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{p.name}</code>
                <code style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'ui-monospace, monospace', flexShrink: 0, fontSize: '0.8125rem' }}>{p.type}</code>
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Example request</p>
        <Code>{example}</Code>
      </div>
      <div>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Example response</p>
        <Code>{response}</Code>
      </div>
    </div>
  )
}

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'companies', label: 'Companies' },
  { id: 'mcp', label: 'MCP Server' },
  { id: 'rss', label: 'RSS Feed' },
  { id: 'rate-limits', label: 'Rate Limits' },
]

export default function ApiDocsPage() {
  return (
    <div style={{ background: 'var(--navy)', color: '#fff', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>

      {/* Top nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
            JobPulse
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/jobs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Browse jobs</Link>
            <Link href="/onboarding/signup"
              style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 600 }}>
              Post a job
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-12">

        {/* Sidebar */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div style={{ position: 'sticky', top: '24px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Contents
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' }}>
              {NAV_ITEMS.map(item => (
                <li key={item.id} style={{ marginBottom: '6px' }}>
                  <a href={`#${item.id}`} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>
              API Reference
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.0625rem' }}>
              Free, open, read-only job data. No authentication required.
            </p>
          </div>

          {/* Overview */}
          <Section id="overview" title="Overview">
            <div style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
              <p style={{ marginBottom: '16px' }}>
                The JobPulse API provides free, read-only access to all job postings and company data in our registry. Build job boards, power AI tools, or syndicate listings — no signup, no API key.
              </p>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
                <p style={{ fontWeight: 600, marginBottom: '8px', color: '#fff' }}>Base URL</p>
                <code style={{ fontFamily: 'ui-monospace, monospace', color: '#93C5FD' }}>https://jobpulse.io/api/v1</code>
              </div>
              <p>All responses are JSON. CORS is enabled for all origins.</p>
            </div>
          </Section>

          {/* Auth */}
          <Section id="auth" title="Authentication">
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, fontSize: '0.9375rem' }}>
              No authentication required for any read endpoints. Just make the request.
            </p>
            <Code>curl https://jobpulse.io/api/v1/jobs</Code>
          </Section>

          {/* Jobs */}
          <Section id="jobs" title="Jobs">
            <Endpoint
              method="GET"
              path="/api/v1/jobs"
              description="Returns a paginated list of all active job postings with company data nested."
              params={[
                { name: 'q', type: 'string', description: 'Full-text search across title and description' },
                { name: 'location', type: 'string', description: 'Filter by location (partial match)' },
                { name: 'type', type: 'string', description: 'full_time | part_time | contract | internship | freelance' },
                { name: 'remote', type: 'boolean', description: 'Set true for remote-only jobs' },
                { name: 'skills', type: 'string', description: 'Comma-separated skills (e.g. React,TypeScript)' },
                { name: 'company_id', type: 'uuid', description: 'Filter by company UUID' },
                { name: 'posted_after', type: 'ISO date', description: 'Filter jobs posted after this date' },
                { name: 'limit', type: 'integer', description: 'Max results (default 20, max 100)' },
                { name: 'offset', type: 'integer', description: 'Pagination offset (default 0)' },
              ]}
              example={`curl "https://jobpulse.io/api/v1/jobs?q=react&location=bangalore&remote=true&limit=5"

# With JS fetch:
const res = await fetch('https://jobpulse.io/api/v1/jobs?q=engineer&limit=10')
const { data, total } = await res.json()`}
              response={`{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-...",
      "title": "Senior React Engineer",
      "description": "<p>We are looking for...</p>",
      "location": "Bangalore",
      "job_type": "full_time",
      "remote": true,
      "skills": ["React", "TypeScript", "GraphQL"],
      "salary_min": 2000000,
      "salary_max": 3000000,
      "salary_currency": "INR",
      "apply_url": "https://acme.com/jobs/apply",
      "posted_at": "2026-06-20T10:00:00Z",
      "expires_at": "2026-08-19T10:00:00Z",
      "views": 142,
      "company": {
        "id": "z9y8x7...",
        "name": "Acme Inc.",
        "website": "https://acme.com",
        "logo_url": null,
        "description": "Building the future."
      }
    }
  ],
  "total": 42,
  "limit": 5,
  "offset": 0
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/jobs/:id"
              description="Returns a single job posting by UUID, with company data nested."
              example={`curl "https://jobpulse.io/api/v1/jobs/a1b2c3d4-e5f6-..."`}
              response={`{
  "id": "a1b2c3d4-...",
  "title": "Senior React Engineer",
  "company": { ... },
  ...
}`}
            />
          </Section>

          {/* Companies */}
          <Section id="companies" title="Companies">
            <Endpoint
              method="GET"
              path="/api/v1/companies"
              description="Returns all companies with an active plan, sorted by join date. Includes open job count."
              params={[
                { name: 'limit', type: 'integer', description: 'Max results (default 20, max 100)' },
                { name: 'offset', type: 'integer', description: 'Pagination offset' },
              ]}
              example={`curl "https://jobpulse.io/api/v1/companies?limit=10"`}
              response={`{
  "data": [
    {
      "id": "z9y8x7...",
      "name": "Acme Inc.",
      "website": "https://acme.com",
      "logo_url": null,
      "description": "Building the future.",
      "created_at": "2026-06-01T00:00:00Z",
      "active_jobs": 5
    }
  ],
  "total": 12,
  "limit": 10,
  "offset": 0
}`}
            />

            <Endpoint
              method="GET"
              path="/api/v1/companies/:id/jobs"
              description="Returns a company's full profile and all their active job listings."
              example={`curl "https://jobpulse.io/api/v1/companies/z9y8x7.../jobs"`}
              response={`{
  "company": { "id": "...", "name": "Acme Inc.", ... },
  "jobs": [ { "id": "...", "title": "..." }, ... ]
}`}
            />
          </Section>

          {/* MCP Server */}
          <Section id="mcp" title="MCP Server">
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, fontSize: '0.9375rem', marginBottom: '24px' }}>
              JobPulse exposes an MCP (Model Context Protocol) server, letting AI assistants like Claude and ChatGPT query live job data directly during conversations.
            </p>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>
              HTTP endpoint
            </h3>
            <Code>POST https://jobpulse.io/api/mcp</Code>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', marginTop: '24px' }}>
              Claude Desktop configuration
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', marginBottom: '8px' }}>
              Add this to your <code style={{ fontFamily: 'ui-monospace, monospace', color: '#93C5FD' }}>claude_desktop_config.json</code>:
            </p>
            <Code>{`{
  "mcpServers": {
    "jobpulse": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://jobpulse.io/api/mcp"]
    }
  }
}`}</Code>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', marginTop: '24px' }}>
              Available tools
            </h3>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              {[
                { name: 'search_jobs', desc: 'Search open positions by query, location, type, skills, or remote flag' },
                { name: 'get_job', desc: 'Get full details of a specific job by UUID' },
                { name: 'list_companies', desc: 'List all companies actively hiring on JobPulse' },
                { name: 'get_company_jobs', desc: 'Get all open jobs at a specific company by name' },
              ].map((t, i, arr) => (
                <div key={t.name} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', display: 'flex', gap: '12px', fontSize: '0.875rem' }}>
                  <code style={{ color: '#93C5FD', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{t.name}</code>
                  <span style={{ color: 'rgba(255,255,255,0.55)' }}>{t.desc}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* RSS */}
          <Section id="rss" title="RSS Feed">
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, fontSize: '0.9375rem', marginBottom: '16px' }}>
              All active jobs are available as an RSS 2.0 feed, updated every 5 minutes.
            </p>
            <Code>GET https://jobpulse.io/api/feed</Code>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem' }}>
              Content-Type: <code style={{ fontFamily: 'ui-monospace, monospace', color: '#93C5FD' }}>application/rss+xml</code>
            </p>
          </Section>

          {/* Rate limits */}
          <Section id="rate-limits" title="Rate Limits">
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, fontSize: '0.9375rem', marginBottom: '16px' }}>
              100 requests per hour per IP address. If you need higher limits for a legitimate integration, reach out.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '16px 20px', fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)' }}>
              <p>All API responses include <code style={{ fontFamily: 'ui-monospace, monospace', color: '#93C5FD' }}>Cache-Control: public, s-maxage=60</code> headers.</p>
              <p style={{ marginTop: '8px' }}>Response headers include <code style={{ fontFamily: 'ui-monospace, monospace', color: '#93C5FD' }}>X-Powered-By: JobPulse by Quorbit</code>.</p>
            </div>
          </Section>

          <div style={{ paddingTop: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '0.9375rem' }}>
            <p>Built something with this API?{' '}
              <a href="mailto:hello@quorbit.com" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline' }}>
                Tell us at hello@quorbit.com
              </a>
            </p>
          </div>
        </main>
      </div>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '24px' }} className="text-center">
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8125rem' }}>
          Powered by{' '}
          <a href="https://quorbit.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>
            Quorbit
          </a>
          {' · '}
          <Link href="/jobs" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Browse jobs</Link>
          {' · '}
          <a href="/api/v1/openapi.json" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>OpenAPI spec</a>
        </p>
      </footer>
    </div>
  )
}
