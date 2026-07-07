'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

interface Integration {
  id: string
  name: string
  logo: string
  color: string
  description: string
  connection_type: 'oauth' | 'api_key' | 'feed' | 'quick'
  region: string[]
  docs_url?: string
  feed_path?: string
  quick_url?: string
  key2_label?: string
  available: boolean
  supports_managed: boolean
  managed_available: boolean
  status: string
  mode: string | null
  connected_at?: string
  last_used_at?: string
}

function IntegrationsContent() {
  const searchParams = useSearchParams()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'connected' | 'india' | 'global'>('all')
  const [connecting, setConnecting] = useState<string | null>(null)
  const [togglingManaged, setTogglingManaged] = useState<string | null>(null)
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, { key: string; key2: string }>>({})
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')

  useEffect(() => {
    if (successParam) showToast(`✓ ${successParam.replace('_', ' ')} connected successfully!`)
    if (errorParam) showToast(`⚠ Connection failed: ${errorParam.replace('_', ' ')}`, true)
  }, [successParam, errorParam])

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(d => {
        setIntegrations(d.integrations ?? [])
        setLoading(false)
      })
  }, [])

  function showToast(msg: string, isError = false) {
    setToast(msg)
    setToastError(isError)
    setTimeout(() => setToast(''), 4000)
  }

  async function handleConnect(id: string) {
    const integ = integrations.find(i => i.id === id)
    if (!integ) return

    if (integ.connection_type === 'oauth') {
      if (id === 'linkedin') {
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID ?? '',
          redirect_uri: `${APP_URL}/api/auth/linkedin/callback`,
          scope: 'w_organization_social r_organization_social rw_organization_admin',
        })
        window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params}`
      } else if (id === 'wellfound') {
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: process.env.NEXT_PUBLIC_WELLFOUND_CLIENT_ID ?? '',
          redirect_uri: `${APP_URL}/api/auth/wellfound/callback`,
          scope: 'jobs:write',
        })
        window.location.href = `https://api.wellfound.com/oauth/authorize?${params}`
      }
      return
    }

    if (integ.connection_type === 'api_key') {
      setExpandedCard(expandedCard === id ? null : id)
    }
  }

  async function handleSaveApiKey(id: string) {
    const vals = apiKeyInputs[id]
    if (!vals?.key) return
    setConnecting(id)

    const res = await fetch('/api/integrations/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: id, api_key: vals.key, extra_key: vals.key2 || undefined }),
    })

    if (res.ok) {
      setIntegrations(prev => prev.map(i => i.id === id
        ? { ...i, status: 'connected', mode: 'owned', connected_at: new Date().toISOString() }
        : i
      ))
      setExpandedCard(null)
      setApiKeyInputs(prev => ({ ...prev, [id]: { key: '', key2: '' } }))
      showToast(`✓ ${integrations.find(i => i.id === id)?.name} connected!`)
    } else {
      showToast('Failed to save credentials', true)
    }
    setConnecting(null)
  }

  async function handleDisconnect(id: string) {
    setConnecting(id)
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: id }),
    })
    setIntegrations(prev => prev.map(i => i.id === id
      ? { ...i, status: 'disconnected', mode: null, connected_at: undefined }
      : i
    ))
    showToast(`${integrations.find(i => i.id === id)?.name} disconnected.`)
    setConnecting(null)
  }

  async function handleToggleManaged(id: string, enable: boolean) {
    setTogglingManaged(id)
    const res = await fetch('/api/integrations/toggle-managed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: id, enabled: enable }),
    })
    if (res.ok) {
      setIntegrations(prev => prev.map(i => i.id === id
        ? { ...i, status: enable ? 'connected' : 'disconnected', mode: enable ? 'managed' : null }
        : i
      ))
      const name = integrations.find(i => i.id === id)?.name ?? id
      showToast(enable ? `✓ ${name}: managed mode enabled` : `${name}: managed mode disabled`)
    } else {
      showToast('Failed to update managed mode', true)
    }
    setTogglingManaged(null)
  }

  const filtered = integrations.filter(i => {
    if (filter === 'connected') return i.status === 'connected'
    if (filter === 'india') return i.region.includes('india')
    if (filter === 'global') return i.region.includes('global')
    return true
  })

  const connectedCount = integrations.filter(i => i.status === 'connected').length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>
              Integrations
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Connect your recruiter accounts — new jobs auto-publish to all connected platforms.
            </p>
          </div>
          <div style={{ background: '#EEF2FF', color: '#4338CA', padding: '6px 16px', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
            {connectedCount} / {integrations.length} connected
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          background: toastError ? '#FEE2E2' : '#DCFCE7',
          color: toastError ? '#991B1B' : '#166534',
          padding: '0.75rem 1rem',
          borderRadius: 8,
          marginBottom: '1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['all', 'connected', 'india', 'global'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 999,
              fontSize: '0.85rem',
              fontWeight: filter === f ? 600 : 400,
              border: '1px solid',
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              background: filter === f ? 'var(--accent)' : '#fff',
              color: filter === f ? '#fff' : 'inherit',
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'All' : f === 'connected' ? `Connected (${connectedCount})` : f === 'india' ? '🇮🇳 India' : '🌐 Global'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center' }}>Loading integrations…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.875rem' }}>
          {filtered.map(integ => (
            <IntegrationCard
              key={integ.id}
              integ={integ}
              isExpanded={expandedCard === integ.id}
              isConnecting={connecting === integ.id}
              isTogglingManaged={togglingManaged === integ.id}
              apiKeyInput={apiKeyInputs[integ.id] ?? { key: '', key2: '' }}
              onApiKeyChange={(field, val) =>
                setApiKeyInputs(prev => ({ ...prev, [integ.id]: { ...(prev[integ.id] ?? { key: '', key2: '' }), [field]: val } }))}
              onConnect={() => handleConnect(integ.id)}
              onSaveApiKey={() => handleSaveApiKey(integ.id)}
              onDisconnect={() => handleDisconnect(integ.id)}
              onToggleManaged={(enable) => handleToggleManaged(integ.id, enable)}
              appUrl={APP_URL}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function statusBadge(integ: Integration) {
  if (integ.connection_type === 'feed') {
    return { label: '● Always active', bg: '#DCFCE7', color: '#166534' }
  }
  if (integ.status !== 'connected') {
    return { label: '○ Not connected', bg: '#F3F4F6', color: '#6B7280' }
  }
  if (integ.mode === 'managed') {
    return { label: '● Active · Managed', bg: '#EEF2FF', color: '#4338CA' }
  }
  return { label: '● Active · Your account', bg: '#DCFCE7', color: '#166534' }
}

function IntegrationCard({
  integ,
  isExpanded,
  isConnecting,
  isTogglingManaged,
  apiKeyInput,
  onApiKeyChange,
  onConnect,
  onSaveApiKey,
  onDisconnect,
  onToggleManaged,
  appUrl,
}: {
  integ: Integration
  isExpanded: boolean
  isConnecting: boolean
  isTogglingManaged: boolean
  apiKeyInput: { key: string; key2: string }
  onApiKeyChange: (field: 'key' | 'key2', val: string) => void
  onConnect: () => void
  onSaveApiKey: () => void
  onDisconnect: () => void
  onToggleManaged: (enable: boolean) => void
  appUrl: string
}) {
  const isConnected = integ.status === 'connected'
  const isFeed = integ.connection_type === 'feed'
  const feedUrl = integ.feed_path ? `${appUrl}${integ.feed_path}` : ''
  const isDualMode = integ.supports_managed && integ.managed_available && integ.connection_type === 'api_key'
  const badge = statusBadge(integ)

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isConnected ? (integ.mode === 'managed' ? '#A5B4FC' : '#86EFAC') : 'var(--border)'}`,
      borderRadius: 12,
      padding: '1.125rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: integ.color + '18',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          flexShrink: 0,
        }}>
          {integ.logo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{integ.name}</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 600,
              background: badge.bg,
              color: badge.color,
            }}>
              {badge.label}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
            {integ.description}
          </p>
        </div>
      </div>

      {/* Region + type badges */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {integ.region.map(r => (
          <span key={r} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#F0FDF4', color: '#166534' }}>
            {r === 'india' ? '🇮🇳 India' : r === 'global' ? '🌐 Global' : r}
          </span>
        ))}
        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#EEF2FF', color: '#4338CA' }}>
          {integ.connection_type === 'oauth' ? '🔑 OAuth' : integ.connection_type === 'api_key' ? '🔐 API Key' : integ.connection_type === 'feed' ? '📡 Auto' : '⚡ Quick Post'}
        </span>
        {isDualMode && (
          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E' }}>
            ✦ Dual mode
          </span>
        )}
      </div>

      {/* Connected info */}
      {isConnected && integ.connected_at && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
          Connected {new Date(integ.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          {integ.last_used_at && ` · Last used ${new Date(integ.last_used_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
        </p>
      )}

      {/* Feed URL */}
      {isFeed && feedUrl && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <code style={{ flex: 1, background: '#F3F4F6', padding: '0.4rem 0.6rem', borderRadius: 6, fontSize: '0.75rem', wordBreak: 'break-all' }}>
            {feedUrl}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(feedUrl)}
            style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Copy
          </button>
          {integ.docs_url && (
            <a href={integ.docs_url} target="_blank" rel="noreferrer"
              style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.75rem', textDecoration: 'none', color: 'inherit', whiteSpace: 'nowrap' }}>
              Docs ↗
            </a>
          )}
        </div>
      )}

      {/* ── Dual-mode section ─────────────────────────────────────────── */}
      {isDualMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Managed option */}
          <div style={{
            padding: '0.75rem',
            background: integ.mode === 'managed' ? '#EEF2FF' : '#F9FAFB',
            borderRadius: 8,
            border: `1px solid ${integ.mode === 'managed' ? '#C7D2FE' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: integ.mode === 'managed' ? '#4338CA' : 'inherit' }}>
                  ✦ Managed by Quorbit
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                  Post via Quorbit&#39;s platform account. No credentials needed.
                </div>
              </div>
              {integ.mode === 'managed' ? (
                <button
                  onClick={() => onToggleManaged(false)}
                  disabled={isTogglingManaged}
                  style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', border: '1px solid #C7D2FE', borderRadius: 6, background: '#fff', color: '#4338CA', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {isTogglingManaged ? '…' : 'Disable'}
                </button>
              ) : !isConnected ? (
                <button
                  onClick={() => onToggleManaged(true)}
                  disabled={isTogglingManaged}
                  style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', border: 'none', borderRadius: 6, background: '#4338CA', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {isTogglingManaged ? '…' : 'Enable →'}
                </button>
              ) : (
                <button
                  onClick={() => onToggleManaged(true)}
                  disabled={isTogglingManaged}
                  style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {isTogglingManaged ? '…' : 'Switch →'}
                </button>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>or use your own account</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Own account form */}
          {integ.mode === 'owned' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 500, flex: 1 }}>Your account is connected.</span>
              <button
                onClick={onDisconnect}
                disabled={isConnecting}
                style={{ fontSize: '0.75rem', color: '#DC2626', background: 'none', border: '1px solid #FECACA', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              {isExpanded ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="API Key"
                    value={apiKeyInput.key}
                    onChange={e => onApiKeyChange('key', e.target.value)}
                    style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
                  />
                  {integ.key2_label && (
                    <input
                      type="text"
                      placeholder={integ.key2_label}
                      value={apiKeyInput.key2}
                      onChange={e => onApiKeyChange('key2', e.target.value)}
                      style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={onSaveApiKey}
                      disabled={isConnecting || !apiKeyInput.key}
                      style={{ flex: 1, padding: '0.5rem', background: isConnecting ? 'var(--muted)' : integ.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {isConnecting ? 'Saving…' : 'Save & Connect'}
                    </button>
                    <button
                      onClick={onConnect}
                      style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', background: '#fff' }}
                    >
                      Cancel
                    </button>
                    {integ.docs_url && (
                      <a href={integ.docs_url} target="_blank" rel="noreferrer"
                        style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', textDecoration: 'none', color: 'inherit' }}>
                        Get key ↗
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={onConnect}
                  style={{ padding: '0.35rem 0.875rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer', background: '#fff', width: '100%', textAlign: 'left' }}
                >
                  Connect your own account →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Single-mode action buttons (non-dual-mode platforms) ─────── */}
      {!isDualMode && !isFeed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* API key form (non-dual-mode) */}
          {integ.connection_type === 'api_key' && isExpanded && !isConnected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: '#F9FAFB', borderRadius: 8, border: '1px solid var(--border)' }}>
              <input
                type="text"
                placeholder="API Key"
                value={apiKeyInput.key}
                onChange={e => onApiKeyChange('key', e.target.value)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
              />
              {integ.key2_label && (
                <input
                  type="text"
                  placeholder={integ.key2_label}
                  value={apiKeyInput.key2}
                  onChange={e => onApiKeyChange('key2', e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.875rem' }}
                />
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={onSaveApiKey}
                  disabled={isConnecting || !apiKeyInput.key}
                  style={{ flex: 1, padding: '0.5rem', background: isConnecting ? 'var(--muted)' : integ.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isConnecting ? 'Saving…' : 'Save & Connect'}
                </button>
                {integ.docs_url && (
                  <a href={integ.docs_url} target="_blank" rel="noreferrer"
                    style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', textDecoration: 'none', color: 'inherit' }}>
                    Get key ↗
                  </a>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
            {isConnected ? (
              <button
                onClick={onDisconnect}
                disabled={isConnecting}
                style={{ fontSize: '0.8rem', color: '#DC2626', background: 'none', border: '1px solid #FECACA', borderRadius: 6, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
              >
                Disconnect
              </button>
            ) : integ.connection_type === 'quick' ? (
              <a
                href={integ.quick_url?.replace('{title}', 'Job Opening').replace('{company}', '').replace('{location}', '').replace('{description}', '') ?? '#'}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', padding: '0.4rem 0.875rem', background: integ.color, color: '#fff', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
              >
                Quick Post ↗
              </a>
            ) : (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                style={{ padding: '0.4rem 0.875rem', background: integ.color, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {integ.connection_type === 'api_key' ? (isExpanded ? 'Cancel ↑' : 'Connect →') : 'Connect →'}
              </button>
            )}
            {integ.docs_url && !isConnected && (
              <a href={integ.docs_url} target="_blank" rel="noreferrer"
                style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', textDecoration: 'none', color: 'var(--muted)' }}>
                Docs ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading…</div>}>
      <IntegrationsContent />
    </Suspense>
  )
}
