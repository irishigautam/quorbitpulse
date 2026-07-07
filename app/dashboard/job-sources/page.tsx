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

const ATS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  greenhouse:      { label: 'Greenhouse',     bg: '#DCFCE7', color: '#15803D' },
  lever:           { label: 'Lever',           bg: '#DBEAFE', color: '#1D4ED8' },
  ashby:           { label: 'Ashby',           bg: '#EDE9FE', color: '#6D28D9' },
  workable:        { label: 'Workable',        bg: '#CFFAFE', color: '#0E7490' },
  smartrecruiters: { label: 'SmartRecruiters', bg: '#FEF3C7', color: '#92400E' },
  html:            { label: 'HTML',            bg: '#F3F4F6', color: '#374151' },
}

export default function JobSourcesPage() {
  const [sources, setSources] = useState<CareerSource[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ company_name: '', career_url: '' })
  const [formError, setFormError] = useState('')
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [scrapeResults, setScrapeResults] = useState<Record<string, { jobs: number; error?: string }>>({})
  const [ingestLoading, setIngestLoading] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ ok: boolean; message: string } | null>(null)

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

  async function handleRunIngest() {
    setIngestLoading(true)
    setIngestResult(null)
    try {
      const res = await fetch('/api/admin/run-ingest', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        const s = data.stats
        const sourceList = Object.entries(s.sources as Record<string, number>)
          .filter(([, count]) => count > 0)
          .map(([src, count]) => `${src}: ${count}`)
          .join(', ')
        setIngestResult({ ok: true, message: `Done! ${s.new} new jobs, ${s.updated} updated, ${s.enriched} enriched. Sources: ${sourceList || 'none'}` })
      } else {
        setIngestResult({ ok: false, message: data.error ?? 'Ingest failed' })
      }
    } catch {
      setIngestResult({ ok: false, message: 'Network error' })
    }
    setIngestLoading(false)
  }

  const activeSources = sources.filter(s => s.active)
  const inactiveSources = sources.filter(s => !s.active)
  const totalJobsToday = sources.reduce((a, s) => a + (s.last_jobs_found || 0), 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Job Sources</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Career pages scraped daily · Greenhouse, Lever, Ashby, Workable, and HTML fallback
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={handleRunIngest}
            disabled={ingestLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: ingestLoading ? 'var(--muted)' : 'var(--accent)', cursor: ingestLoading ? 'not-allowed' : 'pointer' }}
          >
            {ingestLoading ? '⏳ Ingesting…' : '↻ Run ingest now'}
          </button>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Auto-runs daily at 9:30 PM IST</p>
          {ingestResult && (
            <p className="text-xs mt-1 max-w-xs" style={{ color: ingestResult.ok ? '#059669' : '#DC2626' }}>
              {ingestResult.message}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total sources', value: sources.length },
          { label: 'Active',        value: activeSources.length },
          { label: 'Jobs scraped today', value: totalJobsToday },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border p-5">
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{stat.label}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Add source form */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="font-semibold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Add Career Page</h2>
        <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
          <div className="w-48">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Company Name</label>
            <input
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Razorpay"
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-72">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Career Page URL</label>
            <input
              value={form.career_url}
              onChange={e => setForm(f => ({ ...f, career_url: e.target.value }))}
              placeholder="https://jobs.lever.co/razorpay"
              required
              type="url"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: adding ? 'var(--muted)' : 'var(--accent)', cursor: adding ? 'not-allowed' : 'pointer' }}
          >
            {adding ? 'Detecting…' : '+ Add Source'}
          </button>
        </form>
        {formError && <p className="text-xs mt-2 text-red-600">{formError}</p>}
        <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
          ATS type is auto-detected. Paste a Greenhouse, Lever, Ashby, Workable, or SmartRecruiters URL for best results.
        </p>
      </div>

      {/* Sources table */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
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
          {sources.length === 0 && (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <p className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)' }}>No sources yet</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Add a company career page above to start scraping jobs.</p>
            </div>
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
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
        {title}
      </h3>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              {['Company', 'URL', 'ATS', 'Last Scraped', 'Jobs Found', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sources.map(source => {
              const badge = ATS_BADGE[source.ats_type ?? '']
              const isScraping = scrapingId === source.id
              const result = scrapeResults[source.id]

              return (
                <tr key={source.id} className="hover:bg-gray-50">
                  {/* Company */}
                  <td className="px-4 py-3 font-medium">{source.company_name}</td>

                  {/* URL */}
                  <td className="px-4 py-3">
                    <a
                      href={source.career_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {(() => { try { return new URL(source.career_url).hostname.replace('www.', '') } catch { return source.career_url } })()} ↗
                    </a>
                  </td>

                  {/* ATS badge */}
                  <td className="px-4 py-3">
                    {badge ? (
                      <span
                        className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                    )}
                    {source.ats_slug && (
                      <span className="ml-1.5 text-xs" style={{ color: 'var(--muted)' }}>({source.ats_slug})</span>
                    )}
                  </td>

                  {/* Last scraped + error */}
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {source.last_scraped_at
                        ? new Date(source.last_scraped_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : 'Never'}
                    </span>
                    {source.last_error && (
                      <div
                        className="mt-1 text-xs text-red-600 flex items-start gap-1"
                        title={source.last_error}
                      >
                        <span className="shrink-0">⚠️</span>
                        <span className="truncate max-w-44">{source.last_error}</span>
                      </div>
                    )}
                  </td>

                  {/* Jobs found */}
                  <td className="px-4 py-3">
                    <span className="font-semibold">{source.last_jobs_found || 0}</span>
                    {result && (
                      <span className={`ml-2 text-xs ${result.error ? 'text-red-600' : 'text-green-600'}`}>
                        {result.error ? `✗ ${result.error.slice(0, 25)}` : `→ ${result.jobs} found`}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onScrape(source)}
                        disabled={!!scrapingId}
                        title="Scrape now"
                        className="text-xs px-2.5 py-1 rounded-md border font-medium hover:bg-gray-50 disabled:opacity-40"
                        style={{ color: '#059669', borderColor: '#6EE7B7' }}
                      >
                        {isScraping ? '⏳' : '▶ Scrape'}
                      </button>
                      <button
                        onClick={() => onToggle(source.id, !source.active)}
                        title={source.active ? 'Disable' : 'Enable'}
                        className="text-xs px-2.5 py-1 rounded-md border font-medium hover:bg-gray-50"
                        style={{ color: '#D97706', borderColor: '#FDE68A' }}
                      >
                        {source.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => onDelete(source.id)}
                        title="Remove"
                        className="text-xs px-2.5 py-1 rounded-md border font-medium hover:bg-red-50"
                        style={{ color: '#DC2626', borderColor: '#FECACA' }}
                      >
                        Remove
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
