import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quorbit Candidate',
  description: 'Your Quorbit candidate profile',
}

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', fontFamily: 'var(--font-body)' }}>
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', textDecoration: 'none' }}>
          Quorbit
        </a>
        <nav style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
          <a href="/candidate/dashboard" style={{ color: 'var(--text)', textDecoration: 'none' }}>Dashboard</a>
          <a href="/candidate/jobs" style={{ color: 'var(--text)', textDecoration: 'none' }}>Jobs</a>
          <a href="/candidate/login" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Login</a>
        </nav>
      </header>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
