'use client'

import { useState } from 'react'

export default function ApolloImportPage() {
  const [apiKey, setApiKey] = useState('')
  const [query, setQuery] = useState({ title: '', location: '', limit: '25' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const res = await fetch('/api/candidates/import/apollo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: {
          title: query.title || undefined,
          location: query.location || undefined,
          limit: Number(query.limit),
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Import failed')
    else setResult(data)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '620px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>
        Import from Apollo.io
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Search Apollo's database and sync matched candidates directly into your pool.
      </p>

      <form onSubmit={handleImport} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Apollo API Key</label>
          <input
            required type="password" value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Your Apollo.io API key"
            style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
            Find your key at apollo.io → Settings → Integrations → API Keys
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Job Title</label>
            <input
              value={query.title}
              onChange={e => setQuery(q => ({ ...q, title: e.target.value }))}
              placeholder="e.g. Product Manager"
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Location</label>
            <input
              value={query.location}
              onChange={e => setQuery(q => ({ ...q, location: e.target.value }))}
              placeholder="e.g. Bangalore, India"
              style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>Max results</label>
          <select
            value={query.limit}
            onChange={e => setQuery(q => ({ ...q, limit: e.target.value }))}
            style={{ padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.9rem' }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} candidates</option>)}
          </select>
        </div>

        {error && <p style={{ color: '#EF4444', fontSize: '0.85rem' }}>{error}</p>}

        <button
          type="submit" disabled={loading}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Importing…' : 'Search & Import'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: '1.25rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ fontWeight: 600, color: '#065F46', marginBottom: '0.5rem' }}>
            ✓ Imported {result.imported} of {result.total} candidates
            {result.skipped > 0 && ` (${result.skipped} duplicates skipped)`}
          </div>
          {result.candidates?.slice(0, 5).map((c: any) => (
            <div key={c.id} style={{ fontSize: '0.85rem', color: '#374151', padding: '4px 0', borderTop: '1px solid #D1FAE5' }}>
              {c.full_name} — {c.current_title ?? 'Unknown title'} at {c.current_company ?? '—'}
            </div>
          ))}
          {result.candidates?.length > 5 && (
            <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '4px' }}>
              +{result.candidates.length - 5} more
            </div>
          )}
          <a href="/dashboard/candidates" style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
            View candidate pool →
          </a>
        </div>
      )}
    </div>
  )
}
