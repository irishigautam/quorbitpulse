'use client'

/**
 * /chat/[token]
 *
 * Candidate-facing AI chat page. No authentication required.
 * The HMAC-signed token in the URL identifies and authorizes the session.
 *
 * Mobile-first. Works in any modern browser without a login.
 * Fetches initial session state on mount, then drives a POST-per-message loop.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface TranscriptEntry {
  role: 'assistant' | 'user'
  content: string
  ts?: string
}

interface SessionState {
  status: 'loading' | 'active' | 'completed' | 'expired' | 'invalid'
  transcript: TranscriptEntry[]
  jobTitle: string | null
  readinessScore: number | null
}

export default function ChatPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [session, setSession] = useState<SessionState>({
    status: 'loading',
    transcript: [],
    jobTitle: null,
    readinessScore: null,
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Resolve async params
  useEffect(() => {
    params.then(p => setToken(p.token))
  }, [params])

  // Load session on mount
  useEffect(() => {
    if (!token) return

    fetch(`/api/chat/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setSession(s => ({
            ...s,
            status: data.finished ? 'completed' : 'invalid',
          }))
          return
        }

        const status = data.status === 'completed'
          ? 'completed'
          : data.status === 'expired'
          ? 'expired'
          : 'active'

        setSession({
          status,
          transcript: data.transcript ?? [],
          jobTitle: data.job_title,
          readinessScore: data.readiness_score ?? null,
        })

        // If fresh session with no transcript, kick off with an opener
        if (!data.transcript?.length && status === 'active') {
          sendMessage('[START]', token)
        }
      })
      .catch(() => {
        setSession(s => ({ ...s, status: 'invalid' }))
      })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on transcript change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.transcript, sending])

  const sendMessage = useCallback(async (text: string, tok: string) => {
    setSending(true)
    setError(null)

    try {
      const res = await fetch(`/api/chat/${encodeURIComponent(tok)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401 || res.status === 410) {
          setSession(s => ({ ...s, status: 'expired' }))
          return
        }
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSession(s => {
        const prev = s.transcript

        // If the text was the hidden [START] opener, don't add it to transcript
        const userEntry: TranscriptEntry | null =
          text !== '[START]' ? { role: 'user', content: text, ts: new Date().toISOString() } : null

        const assistantEntry: TranscriptEntry = {
          role: 'assistant',
          content: data.reply,
          ts: new Date().toISOString(),
        }

        return {
          ...s,
          transcript: userEntry ? [...prev, userEntry, assistantEntry] : [...prev, assistantEntry],
          status: data.finished ? 'completed' : 'active',
          readinessScore: data.readiness_score ?? s.readinessScore,
        }
      })
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !input.trim() || sending || session.status !== 'active') return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg, token)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (session.status === 'loading') {
    return <LoadingScreen />
  }

  if (session.status === 'invalid') {
    return (
      <ErrorScreen
        title="Invalid link"
        message="This chat link is invalid or has expired. Please ask the recruiter for a new one."
      />
    )
  }

  if (session.status === 'expired') {
    return (
      <ErrorScreen
        title="Link expired"
        message="This chat link has expired. Chat links are valid for 7 days. Please contact the recruiter to request a new one."
      />
    )
  }

  if (session.status === 'completed') {
    return <CompletedScreen readinessScore={session.readinessScore} jobTitle={session.jobTitle} />
  }

  // ── Active chat ────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <span style={styles.logo}>Q</span>
          <div>
            <p style={styles.headerTitle}>Quorbit Pulse</p>
            {session.jobTitle && (
              <p style={styles.headerSubtitle}>{session.jobTitle}</p>
            )}
          </div>
        </div>
        <span style={styles.activeDot}>● Live</span>
      </header>

      {/* Messages */}
      <main style={styles.messages}>
        {session.transcript.map((entry, i) => (
          <div key={i} style={entry.role === 'user' ? styles.userRow : styles.assistantRow}>
            {entry.role === 'assistant' && (
              <div style={styles.aiBubble}>
                <span style={styles.aiAvatar}>Q</span>
              </div>
            )}
            <div
              style={entry.role === 'user' ? styles.userBubble : styles.assistantBubble}
            >
              {entry.content.split('\n').map((line, li) => (
                <span key={li}>{line}{li < entry.content.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ))}

        {sending && (
          <div style={styles.assistantRow}>
            <div style={styles.aiBubble}>
              <span style={styles.aiAvatar}>Q</span>
            </div>
            <div style={styles.assistantBubble}>
              <span style={styles.typingDots}>···</span>
            </div>
          </div>
        )}

        {error && (
          <div style={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reply…"
          rows={1}
          maxLength={1000}
          disabled={sending}
          style={styles.textarea}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          style={{
            ...styles.sendBtn,
            opacity: (!input.trim() || sending) ? 0.4 : 1,
          }}
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={styles.statusCard}>
        <div style={styles.spinner} />
        <p style={{ color: '#555', fontSize: 15 }}>Loading your session…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={styles.statusCard}>
        <span style={{ fontSize: 36, marginBottom: 12 }}>🔗</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, textAlign: 'center' }}>{message}</p>
      </div>
    </div>
  )
}

function CompletedScreen({ readinessScore, jobTitle }: { readinessScore: number | null; jobTitle: string | null }) {
  return (
    <div style={{ ...styles.root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={styles.statusCard}>
        <span style={{ fontSize: 40, marginBottom: 12 }}>✅</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          All done!
        </h1>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, textAlign: 'center', marginBottom: 16 }}>
          Thanks for chatting with us{jobTitle ? ` about the ${jobTitle} role` : ''}. The team will be in touch soon.
        </p>
        {readinessScore !== null && (
          <div style={{ background: '#F0EEF9', borderRadius: 12, padding: '12px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600, marginBottom: 4 }}>YOUR READINESS SCORE</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: '#5B21B6' }}>{readinessScore}<span style={{ fontSize: 16 }}>/100</span></p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: '#F7F6F3',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    maxWidth: 680,
    margin: '0 auto',
    position: 'relative',
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #E5E4E0',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    background: '#7C3AED',
    color: '#fff',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 800,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
    margin: 0,
    marginTop: 2,
  },
  activeDot: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: 600,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  assistantRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  aiBubble: {
    flexShrink: 0,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    background: '#7C3AED',
    color: '#fff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
  } as React.CSSProperties,
  assistantBubble: {
    background: '#fff',
    border: '1px solid #E5E4E0',
    borderRadius: '4px 16px 16px 16px',
    padding: '10px 14px',
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 1.6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  },
  userBubble: {
    background: '#7C3AED',
    borderRadius: '16px 4px 16px 16px',
    padding: '10px 14px',
    fontSize: 14,
    color: '#fff',
    lineHeight: 1.6,
  },
  typingDots: {
    letterSpacing: 2,
    color: '#aaa',
    fontSize: 18,
    animation: 'pulse 1.2s infinite',
  },
  errorBanner: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#B91C1C',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#B91C1C',
    fontSize: 18,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '12px 12px 16px',
    background: '#fff',
    borderTop: '1px solid #E5E4E0',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    border: '1.5px solid #E5E4E0',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.5,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    background: '#F7F6F3',
    color: '#1a1a1a',
    minHeight: 44,
    maxHeight: 140,
    overflowY: 'auto',
  },
  sendBtn: {
    width: 44,
    height: 44,
    background: '#7C3AED',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  statusCard: {
    background: '#fff',
    border: '1px solid #E5E4E0',
    borderRadius: 20,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    margin: 24,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E5E4E0',
    borderTopColor: '#7C3AED',
    borderRadius: '50%',
    marginBottom: 16,
    animation: 'spin 0.8s linear infinite',
  },
}
