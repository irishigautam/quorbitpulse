'use client'

/**
 * /consent/llm-export/[token]
 *
 * Candidate-facing consent page (Gate 1 — AI sync consent UX). No
 * authentication required — the HMAC-signed token in the URL identifies
 * and authorizes the request, matching the /chat/[token] page pattern.
 *
 * The candidate approves or denies a specific company's request to
 * analyse a ChatGPT/Claude export they'd provide. Nothing is uploaded or
 * processed until they approve here.
 */

import { useState, useEffect } from 'react'

type ViewState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'superseded' }
  | { status: 'decide'; candidateFirstName: string; companyName: string; expiresAt: string | null }
  | { status: 'approved'; companyName: string }
  | { status: 'denied'; companyName: string }

export default function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ status: 'loading' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return

    fetch(`/api/consent/llm-export/${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) {
          setView({ status: r.status === 410 ? 'superseded' : 'invalid' })
          return
        }
        if (data.status === 'approved') {
          setView({ status: 'approved', companyName: data.companyName })
        } else if (data.status === 'denied') {
          setView({ status: 'denied', companyName: data.companyName })
        } else {
          setView({
            status: 'decide',
            candidateFirstName: data.candidateFirstName,
            companyName: data.companyName,
            expiresAt: data.expiresAt,
          })
        }
      })
      .catch(() => setView({ status: 'invalid' }))
  }, [token])

  async function respond(approve: boolean) {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/consent/llm-export/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setView(v =>
        v.status === 'decide'
          ? { status: approve ? 'approved' : 'denied', companyName: v.companyName }
          : v,
      )
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.logo}>Q</div>

        {view.status === 'loading' && (
          <>
            <div style={styles.spinner} />
            <p style={styles.muted}>Loading…</p>
          </>
        )}

        {view.status === 'invalid' && (
          <>
            <span style={styles.emoji}>🔗</span>
            <h1 style={styles.title}>Invalid link</h1>
            <p style={styles.body}>
              This link is invalid or has expired. If you'd still like to respond, ask the company
              to send you a new request.
            </p>
          </>
        )}

        {view.status === 'superseded' && (
          <>
            <span style={styles.emoji}>🔄</span>
            <h1 style={styles.title}>This link is out of date</h1>
            <p style={styles.body}>
              A newer request has replaced this one. Check your email for the most recent message,
              or ask the company to resend it.
            </p>
          </>
        )}

        {view.status === 'decide' && (
          <>
            <span style={styles.emoji}>🔒</span>
            <h1 style={styles.title}>{view.companyName} would like your permission</h1>
            <p style={styles.body}>
              Hi {view.candidateFirstName} — {view.companyName} is asking to analyse a ChatGPT or
              Claude conversation export you'd provide, to better understand your skills and
              experience for your application.
            </p>
            <ul style={styles.list}>
              <li>Only work-relevant content would ever be used.</li>
              <li>Personal conversations are filtered out automatically and never stored.</li>
              <li>This is entirely optional — declining won't count against your application.</li>
            </ul>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttonRow}>
              <button
                onClick={() => respond(true)}
                disabled={submitting}
                style={{ ...styles.approveBtn, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Saving…' : 'Approve'}
              </button>
              <button
                onClick={() => respond(false)}
                disabled={submitting}
                style={{ ...styles.denyBtn, opacity: submitting ? 0.6 : 1 }}
              >
                Decline
              </button>
            </div>
          </>
        )}

        {view.status === 'approved' && (
          <>
            <span style={styles.emoji}>✅</span>
            <h1 style={styles.title}>You approved this request</h1>
            <p style={styles.body}>
              {view.companyName} can now analyse the chat export you provide them. You can reach
              out to them directly if you change your mind.
            </p>
          </>
        )}

        {view.status === 'denied' && (
          <>
            <span style={styles.emoji}>🚫</span>
            <h1 style={styles.title}>You declined this request</h1>
            <p style={styles.body}>
              {view.companyName} will not analyse any chat export for your application. This
              won't affect your application otherwise.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F7F6F3',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 24,
  },
  card: {
    background: '#fff',
    border: '1px solid #E5E4E0',
    borderRadius: 20,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    background: '#7C3AED',
    color: '#fff',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 800,
    marginBottom: 20,
  },
  emoji: { fontSize: 38, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 10, lineHeight: 1.3 },
  body: { fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 4 },
  muted: { fontSize: 14, color: '#888' },
  list: {
    textAlign: 'left',
    fontSize: 13,
    color: '#555',
    lineHeight: 1.7,
    margin: '16px 0 20px',
    paddingLeft: 20,
  },
  error: {
    color: '#B91C1C',
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
    width: '100%',
  },
  buttonRow: { display: 'flex', gap: 10, width: '100%', marginTop: 4 },
  approveBtn: {
    flex: 1,
    padding: '12px 20px',
    borderRadius: 12,
    border: 'none',
    background: '#7C3AED',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  denyBtn: {
    flex: 1,
    padding: '12px 20px',
    borderRadius: 12,
    border: '1.5px solid #E5E4E0',
    background: '#fff',
    color: '#555',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #E5E4E0',
    borderTopColor: '#7C3AED',
    borderRadius: '50%',
    marginBottom: 12,
    animation: 'spin 0.8s linear infinite',
  },
}
