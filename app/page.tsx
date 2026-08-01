import Link from 'next/link'
import type { Metadata } from 'next'
import LiveJobCounter from './LiveJobCounter'

export const metadata: Metadata = {
  title: 'JobPulse — Your candidates, finally scored.',
}

const CODE_SAMPLE = `curl "https://jobpulse.io/api/v1/jobs?q=react&limit=5"

# Response:
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "title": "Senior React Engineer",
      "company": { "name": "Acme Inc." },
      "location": "Bangalore",
      "remote": true,
      "skills": ["React", "TypeScript", "GraphQL"],
      "apply_url": "https://acme.com/jobs/apply"
    }
  ],
  "total": 42,
  "limit": 5
}`

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--navy)', color: '#fff', fontFamily: 'var(--font-body)', minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>
            JobPulse
          </span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/jobs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
              className="hidden sm:inline">
              Browse jobs
            </Link>
            <Link href="/api-docs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
              className="hidden sm:inline">
              API docs
            </Link>
            <Link href="/onboarding/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Sign in
            </Link>
            <Link href="/onboarding/signup"
              style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '8px 18px', borderRadius: '8px', fontWeight: 600 }}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-sm"
          style={{ background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(37,99,235,0.4)', color: '#93C5FD' }}>
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
          <LiveJobCounter />
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '1.5rem' }}>
          Your pipeline,<br />
          <span style={{ color: 'var(--accent)' }}>finally scored.</span>
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(1rem, 2vw, 1.25rem)', maxWidth: '620px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Import candidates from LinkedIn, Naukri, Apollo, or a CSV — however you already source. Quorbit Pulse scores every one against your open roles and validates readiness with a short AI chat, so you interview five people instead of scanning two hundred.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/onboarding/signup"
            style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '14px 28px', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>
            Start scoring candidates — ₹3,999/year
          </Link>
          <Link href="/jobs"
            style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', padding: '14px 28px', borderRadius: '10px', fontWeight: 600, fontSize: '1rem', border: '1px solid rgba(255,255,255,0.2)' }}>
            Browse open jobs
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-semibold uppercase tracking-widest mb-12"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            How it works
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Import from anywhere', body: 'Upload a CSV, paste LinkedIn or Naukri profiles, or connect Apollo. No new sourcing habit to learn — keep working the way you already do.' },
              { step: '02', title: 'AI scores every candidate', body: 'Each profile is fingerprinted for skills, seniority, and domain, then matched against your open roles in seconds — not hours of manual screening.' },
              { step: '03', title: 'AI chat validates readiness', body: 'A short automated conversation confirms fit and interest before you spend interview time. Blended score: 70% role match + 30% chat signal.' },
            ].map(item => (
              <div key={item.step}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: 'rgba(37,99,235,0.25)', lineHeight: 1, marginBottom: '0.75rem' }}>
                  {item.step}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, fontSize: '0.9375rem' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For companies */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
                For recruiting teams
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: '1.5rem', lineHeight: 1.2 }}>
                Stop scanning resumes.<br />Start reviewing a shortlist.
              </h2>
              <div className="space-y-4">
                {[
                  ['AI candidate scoring & fingerprinting', 'Every imported candidate gets a match score against your role — skills, domain, seniority, and experience.'],
                  ['AI chat validates fit', 'A short automated conversation checks readiness and interest before you schedule a call.'],
                  ['Works with your existing sourcing', 'Keep sourcing from LinkedIn, Naukri, Apollo, or referrals — Quorbit Pulse sits on top, not instead of.'],
                  ['Also reaches 14 job boards', 'Post once and your listing auto-distributes to Google Jobs, AI assistants, and more — for candidates you don’t already have.'],
                ].map(([title, body]) => (
                  <div key={title} className="flex gap-3">
                    <span style={{ color: 'var(--accent)', fontSize: '1.25rem', marginTop: '2px', flexShrink: 0 }}>✓</span>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: '2px' }}>{title}</p>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', lineHeight: 1.6 }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/onboarding/signup"
                style={{ display: 'inline-block', marginTop: '2rem', background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                Start scoring →
              </Link>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '20px' }}>Annual Plan</p>
              <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>₹3,999</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', marginBottom: '24px' }}>per year · ~$49 USD</p>
              <div className="space-y-3 text-sm">
                {['AI candidate scoring & fingerprinting', 'AI chat readiness validation', '30 active job postings', 'Live for 60 days each', 'Google Jobs indexing', 'AI search visibility', 'REST API + MCP + RSS', 'Dashboard + analytics', 'Email confirmations'].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span style={{ color: 'var(--accent)' }}>✓</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/onboarding/signup"
                style={{ display: 'block', marginTop: '24px', background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '12px', borderRadius: '10px', fontWeight: 700, textAlign: 'center', fontFamily: 'var(--font-display)' }}>
                Get started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* For developers */}
      <section style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
                For developers & platforms
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: '1.5rem', lineHeight: 1.2 }}>
                A free, open job data API.
              </h2>
              <div className="space-y-3 text-sm mb-8">
                {[
                  'Free public REST API — no API key, no auth',
                  'MCP server for AI agents (Claude, GPT, etc.)',
                  'RSS feed for aggregators and job boards',
                  'OpenAPI 3.0 spec at /api/v1/openapi.json',
                  '100 req/hour rate limit per IP',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span style={{ color: 'var(--accent)' }}>✓</span>
                    <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/api-docs"
                style={{ display: 'inline-block', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.875rem' }}>
                Read the docs →
              </Link>
            </div>
            <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28CA41', display: 'inline-block' }} />
                <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>Terminal</span>
              </div>
              <pre style={{ margin: 0, padding: '20px', fontSize: '0.75rem', lineHeight: 1.7, color: '#ABB2BF', overflow: 'auto', fontFamily: 'ui-monospace, monospace' }}>
                <code>{CODE_SAMPLE}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* For job seekers */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
            For job seekers
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: '1rem', lineHeight: 1.2 }}>
            Find your next role. No account needed.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: '2.5rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
            Browse all jobs for free. No login, no resume upload, no profile creation. Apply directly to companies.
          </p>
          <Link href="/jobs"
            style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'inline-block', marginBottom: '2rem' }}>
            Browse all jobs
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
            Coming in V2: AI-powered job matching via MCP
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '4px' }}>JobPulse</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem' }}>
              Powered by{' '}
              <a href="https://quorbit.com" target="_blank" rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline' }}>
                Quorbit
              </a>
            </p>
          </div>
          <div className="flex flex-wrap gap-4 justify-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <Link href="/jobs" style={{ color: 'inherit', textDecoration: 'none' }}>Jobs</Link>
            <Link href="/api-docs" style={{ color: 'inherit', textDecoration: 'none' }}>API Docs</Link>
            <Link href="/onboarding/signup" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</Link>
            <a href="mailto:hello@quorbit.com" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.8125rem', textAlign: 'center' }}>
            © 2026 Quorbit. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
