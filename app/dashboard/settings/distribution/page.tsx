'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

const LINKEDIN_AUTH_URL = () => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID ?? '',
    redirect_uri: `${APP_URL}/api/auth/linkedin/callback`,
    scope: 'w_organization_social r_organization_social rw_organization_admin',
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`
}

interface Company {
  linkedin_access_token?: string | null
  linkedin_org_urn?: string | null
  linkedin_token_expires_at?: string | null
  naukri_api_key?: string | null
  naukri_client_id?: string | null
}

function DistributionSettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [company, setCompany] = useState<Company>({})
  const [naukriKey, setNaukriKey] = useState('')
  const [naukriClientId, setNaukriClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')

  useEffect(() => {
    fetch('/api/company/me')
      .then(r => r.json())
      .then(d => setCompany(d.company ?? {}))
  }, [])

  const linkedInConnected =
    !!company.linkedin_access_token &&
    (!company.linkedin_token_expires_at || new Date(company.linkedin_token_expires_at) > new Date())

  const naukriConnected = !!company.naukri_api_key

  const handleSaveNaukri = async () => {
    if (!naukriKey || !naukriClientId) return setMsg('Both API Key and Client ID are required.')
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/distribution/naukri-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: naukriKey, client_id: naukriClientId }),
    })
    if (res.ok) {
      setMsg('Naukri connected successfully.')
      setCompany(c => ({ ...c, naukri_api_key: naukriKey, naukri_client_id: naukriClientId }))
      setNaukriKey('')
      setNaukriClientId('')
    } else {
      setMsg('Failed to save Naukri credentials.')
    }
    setSaving(false)
  }

  const handleDisconnectNaukri = async () => {
    setSaving(true)
    await fetch('/api/distribution/naukri-key', { method: 'DELETE' })
    setCompany(c => ({ ...c, naukri_api_key: null, naukri_client_id: null }))
    setMsg('Naukri disconnected.')
    setSaving(false)
  }

  const handleDisconnectLinkedIn = async () => {
    setSaving(true)
    await fetch('/api/distribution/linkedin-disconnect', { method: 'POST' })
    setCompany(c => ({ ...c, linkedin_access_token: null }))
    setMsg('LinkedIn disconnected.')
    setSaving(false)
  }

  const feedUrl = `${APP_URL}/api/feeds/indeed`

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          Job Distribution
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          When you post a job, it automatically publishes to all connected platforms.
        </p>
      </div>

      {successParam === 'linkedin' && (
        <div style={{ background: '#DCFCE7', color: '#166534', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
          ✓ LinkedIn connected successfully. New jobs will auto-post to your page.
        </div>
      )}
      {errorParam && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
          LinkedIn connection failed. Please try again.
        </div>
      )}
      {msg && (
        <div style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Google Jobs — always active */}
        <ChannelCard
          logo="🔍"
          name="Google Jobs"
          description="Jobs appear in Google Search results automatically via structured data."
          status="active"
          statusLabel="Always active"
        />

        {/* Indeed XML Feed */}
        <ChannelCard
          logo="🔵"
          name="Indeed · SimplyHired · Jora · Glassdoor"
          description="All four platforms ingest the same XML feed. Register the feed URL in Indeed's Employer portal once."
          status="active"
          statusLabel="Feed ready"
        >
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              Register this URL in{' '}
              <a href="https://employers.indeed.com/p/post-jobs/xml-feed" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                Indeed Employer Portal
              </a>{' '}
              (one-time setup):
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <code style={{ flex: 1, background: '#F3F4F6', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {feedUrl}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(feedUrl); setMsg('Feed URL copied!') }}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Copy
              </button>
            </div>
          </div>
        </ChannelCard>

        {/* LinkedIn */}
        <ChannelCard
          logo="💼"
          name="LinkedIn"
          description="Post jobs as LinkedIn updates on your company page. Requires connecting your LinkedIn Company Page."
          status={linkedInConnected ? 'active' : 'disconnected'}
          statusLabel={linkedInConnected ? 'Connected' : 'Not connected'}
        >
          <div style={{ marginTop: '0.75rem' }}>
            {linkedInConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#166534' }}>
                  ✓ Company page connected
                  {company.linkedin_token_expires_at && (
                    <span style={{ color: 'var(--muted)', marginLeft: '0.5rem' }}>
                      (expires {new Date(company.linkedin_token_expires_at).toLocaleDateString()})
                    </span>
                  )}
                </span>
                <button
                  onClick={handleDisconnectLinkedIn}
                  disabled={saving}
                  style={{ fontSize: '0.8rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href={LINKEDIN_AUTH_URL()}
                style={{
                  display: 'inline-block',
                  background: '#0A66C2',
                  color: '#fff',
                  padding: '0.5rem 1.25rem',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Connect LinkedIn Page →
              </a>
            )}
          </div>
        </ChannelCard>

        {/* Naukri */}
        <ChannelCard
          logo="🟠"
          name="Naukri.com"
          description="Post directly to Naukri using your Naukri RMS API credentials. Get your API key from your Naukri recruiter account."
          status={naukriConnected ? 'active' : 'disconnected'}
          statusLabel={naukriConnected ? 'Connected' : 'Not connected'}
        >
          <div style={{ marginTop: '0.75rem' }}>
            {naukriConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#166534' }}>✓ API key saved</span>
                <button
                  onClick={handleDisconnectNaukri}
                  disabled={saving}
                  style={{ fontSize: '0.8rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Naukri API Key"
                  value={naukriKey}
                  onChange={e => setNaukriKey(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                <input
                  type="text"
                  placeholder="Naukri Client ID"
                  value={naukriClientId}
                  onChange={e => setNaukriClientId(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
                />
                <button
                  onClick={handleSaveNaukri}
                  disabled={saving || !naukriKey || !naukriClientId}
                  style={{
                    padding: '0.5rem 1.25rem',
                    background: saving ? 'var(--muted)' : '#F97316',
                    color: '#fff',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Naukri credentials'}
                </button>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Get your API key from{' '}
                  <a href="https://recruiter.naukri.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    recruiter.naukri.com
                  </a>{' '}
                  → Settings → API Access
                </p>
              </div>
            )}
          </div>
        </ChannelCard>
      </div>
    </div>
  )
}

function ChannelCard({
  logo,
  name,
  description,
  status,
  statusLabel,
  children,
}: {
  logo: string
  name: string
  description: string
  status: 'active' | 'disconnected'
  statusLabel: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{logo}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{name}</div>
            <div style={{ fontSize: '0.83rem', color: 'var(--muted)' }}>{description}</div>
          </div>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            background: status === 'active' ? '#DCFCE7' : '#F3F4F6',
            color: status === 'active' ? '#166534' : '#6B7280',
          }}
        >
          {statusLabel}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function DistributionSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <DistributionSettingsContent />
    </Suspense>
  )
}
