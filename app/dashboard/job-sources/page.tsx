'use client'

import { useState, useEffect, useCallback } from 'react'

interface CareerSource {
  id: string
  company_name: string
  career_url: string
  ats_type: string | null
  ats_slug: string | null
  active: boolean
  last_scraped_at: string | null
  last_jobs_found: number
  total_jobs_ingested: number
  error_count: number
  last_error: string | null
  created_at: string
}

const ATS_BADGE: Record<string, { label: string; color: string }> = {
  greenhouse:      { label: 'Greenhouse',      color: '#24a148' },
  lever:           { label: 'Lever',            color: '#0052cc' },
  ashby:           { label: 'Ashby',            color: '#7c3aed' },
  workable:        { label: 'Workable',         color: '#0097a7' },
  smartrecruiters: { label: 'SmartRecruiters',  color: '#e65100' },
  html:            { label: 'HTML scrape',      color: '#78909c' },
}

export default function JobSourcesPage() {
  const [sources, setSources] = useState<CareerSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ company_name: '', career_url: '' })
  const [formError, setFormError] = useState('')
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [scrapeResults, setScrapeResults] = useState<Record<string, { jobs: number; error?: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/job-sources')
    const data = await res.json()
    setSources(data.sources ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setAdding(true)
    try {
      const res = await fetch('/api/job-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error || 'Failed to add'); setAdding(false); return }
      setForm({ company_name: '', career_url: '' })
      await load()
    } catch {
      setFormError('Network error')
    }
    setAdding(false)
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/job-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    })
    setSources(s => s.map(src => src.id === id ? { ...src, active } : src))
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this source?')) return
    await fetch(`/api/job-sources/${id}`, { method: 'DELETE' })
    setSources(s => s.filter(src => src.id !== id))
  }

  async function handleScrape(source: CareerSource) {
    setScrapingId(source.id)
    setScrapeResults(r => { const n = { ...r }; delete n[source.id]; return n })
    const res = await fetch(`/api/job-sources/${source.id}/scrape`, { method: 'POST' })
    const data = await res.json()
    setScrapeResults(r => ({ ...r, [source.id]: { jobs: data.jobs_found ?? 0, error: data.error } }))
    setScrapingId(null)
    await load()
  }

  const activeSources = sources.filter(s => s.active)
  const inactiveSources = sources.filter(s => !s.active)

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Job Sources</h1>
        <p style={{ color: '#888', marginTop: 4 }}>
          Company career pages scraped daily. Supports Greenhouse, Lever, Ashby, Workable, SmartRecruiters, and custom HTML.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total sources', value: sources.length },
          { label: 'Active', value: activeSources.length },
          { label: 'Jobs found today', value: sources.reduce((a, s) => a + (s.last_jobs_found || 0), 0) },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
            padding: '16px 24px', flex: 1,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div style={{
        background: '#111', border: '1px solid #333', borderRadius: 10, padding: 24, marginBottom: 32,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>Add Career Page</h2>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 200px' }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Company Name</label>
            <input
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Razorpay"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Career Page URL</label>
            <input
              value={form.career_url}
              onChange={e => setForm(f => ({ ...f, career_url: e.target.value }))}
              placeholder="https://jobs.lever.co/razorpay"
              required
              type="url"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            style={{
              background: '#fff', color: '#000', border: 'none', borderRadius: 6,
              padding: '10px 20px', fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer',
              opacity: adding ? 0.6 : 1,
            }}
          >
            {adding ? 'Detecting ATS…' : '+ Add Source'}
          </button>
        </form>
        {formError && <p style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>{formError}</p>}
        <p style={{ color: '#555', fontSize: 12, marginTop: 12, margin: '12px 0 0' }}>
          ATS is auto-detected from the URL. Paste a Greenhouse, Lever, Ashby, Workable or SmartRecruiters URL for best results.
        </p>
      </div>

      {/* Sources table */}
      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : (
        <>
          <SourceTable
            sources={activeSources}
            title={`Active (${activeSources.length})`}
            scrapingId={scrapingId}
            scrapeResults={scrapeResults}
            onToggle={toggleActive}
            onDelete={handleDelete}
            onScrape={handleScrape}
          />
          {inactiveSources.length > 0 && (
            <SourceTable
              sources={inactiveSources}
              title={`Disabled (${inactiveSources.length})`}
              scrapingId={scrapingId}
              scrapeResults={scrapeResults}
              onToggle={toggleActive}
              onDelete={handleDelete}
              onScrape={handleScrape}
            />
          )}
        </>
      )}
    </div>
  )
}

function SourceTable({
  sources, title, scrapingId, scrapeResults, onToggle, onDelete, onScrape,
}: {
  sources: CareerSource[]
  title: string
  scrapingId: string | null
  scrapeResults: Record<string, { jobs: number; error?: string }>
  onToggle: (id: string, active: boolean) => void
  onDelete: (id: string) => void
  onScrape: (source: CareerSource) => void
}) {
  if (sources.length === 0) return null

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      <div style={{ border: '1px solid #333', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #333' }}>
              {['Company', 'URL', 'ATS', 'Last Scraped', 'Jobs Found', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#666', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((source, i) => {
              const atsBadge = ATS_BADGE[source.ats_type ?? '']
              const isScraping = scrapingId === source.id
              const result = scrapeResults[source.id]

              return (
                <tr
                  key={source.id}
                  style={{ borderBottom: i < sources.length - 1 ? '1px solid #222' : 'none', background: '#0a0a0a' }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{source.company_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <a
                      href={source.career_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }}
                    >
                      {new URL(source.career_url).hostname.replace('www.', '')}
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {atsBadge ? (
                      <span style={{
                        background: atsBadge.color + '22', color: atsBadge.color,
                        border: `1px solid ${atsBadge.color}44`,
                        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>
                        {atsBadge.label}
                      </span>
                    ) : (
                      <span style={{ color: '#555', fontSize: 11 }}>Undetected</span>
                    )}
                    {source.ats_slug && (
                      <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>({source.ats_slug})</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#888', fontSize: 12 }}>
                    {source.last_scraped_at
                      ? new Date(source.last_scraped_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                      : 'Never'}
                    {source.last_error && (
                      <div style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }} title={source.last_error}>
                        ⚠ {source.last_error.slice(0, 40)}…
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600 }}>{source.last_jobs_found || 0}</span>
                    {result && (
                      <span style={{ marginLeft: 8, color: result.error ? '#ef4444' : '#22c55e', fontSize: 11 }}>
                        {result.error ? `✗ ${result.error.slice(0, 30)}` : `→ ${result.jobs} found`}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => onScrape(source)}
                        disabled={!!scrapingId}
                        title="Scrape now"
                        style={actionBtn('#1a3a2a', '#22c55e')}
                      >
                        {isScraping ? '⟳' : '▶'}
                      </button>
                      <button
                        onClick={() => onToggle(source.id, !source.active)}
                        title={source.active ? 'Disable' : 'Enable'}
                        style={actionBtn('#2a2a1a', '#facc15')}
                      >
                        {source.active ? '⏸' : '▶'}
                      </button>
                      <button
                        onClick={() => onDelete(source.id)}
                        title="Remove"
                        style={actionBtn('#2a1a1a', '#ef4444')}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 6,
  padding: '9px 12px',
  color: '#fff',
  fontSize: 14,
  boxSizing: 'border-box',
}

const actionBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color,
  border: `1px solid ${color}44`,
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
})
