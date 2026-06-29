import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security — Quorbit Pulse',
  description: 'Security practices and controls implemented in Quorbit Pulse.',
}

const CONTROLS = [
  {
    category: 'Authentication & Authorization',
    icon: '🔐',
    items: [
      {
        title: 'Supabase Auth with JWT sessions',
        detail:
          'All user sessions are managed by Supabase Auth using short-lived JWTs. Tokens are refreshed automatically via secure HttpOnly cookies. Passwords are hashed with bcrypt and never stored in plaintext.',
      },
      {
        title: 'Row-Level Security (RLS) on all database tables',
        detail:
          'Every table in the PostgreSQL database has RLS policies enforced at the database engine level. A company can only read or write its own rows — even if an API route had a bug, the database would reject cross-company queries.',
      },
      {
        title: 'Server-side auth check on every API route',
        detail:
          'All protected API routes call requireCompany() which re-validates the session token against the database on every request. There is no client-side-only auth gate.',
      },
      {
        title: 'Active plan check before data access',
        detail:
          'requireCompany() also verifies that the company has an active subscription. Expired or unpaid accounts are redirected before any data is returned.',
      },
    ],
  },
  {
    category: 'Transport Security',
    icon: '🔒',
    items: [
      {
        title: 'TLS 1.2+ enforced (HTTPS only)',
        detail:
          'All traffic is served over HTTPS. The Strict-Transport-Security header is set with a 1-year max-age and includeSubDomains, meaning browsers will never attempt a plain HTTP connection.',
      },
      {
        title: 'HSTS preload eligible',
        detail:
          'The HSTS header includes the preload directive, making the domain eligible for inclusion in browser HSTS preload lists — preventing even the first unencrypted request.',
      },
    ],
  },
  {
    category: 'HTTP Security Headers',
    icon: '🛡️',
    items: [
      {
        title: 'Content Security Policy (CSP)',
        detail:
          "A strict CSP is applied to every response. Scripts may only load from the same origin and the Razorpay payment SDK. iframes are blocked entirely (frame-ancestors 'none'). Inline eval is restricted to what Next.js requires.",
      },
      {
        title: 'X-Frame-Options: DENY',
        detail:
          'The application cannot be embedded in any iframe on any other domain, preventing clickjacking attacks.',
      },
      {
        title: 'X-Content-Type-Options: nosniff',
        detail:
          'Browsers are instructed not to MIME-sniff responses, preventing content-type confusion attacks.',
      },
      {
        title: 'Referrer-Policy: strict-origin-when-cross-origin',
        detail:
          'Full URLs are only sent in the Referer header on same-origin requests. Cross-origin requests receive only the origin, preventing accidental leakage of URL parameters.',
      },
      {
        title: 'Permissions-Policy',
        detail:
          'Camera, microphone, geolocation, and USB access are all explicitly disabled at the browser policy level.',
      },
    ],
  },
  {
    category: 'Rate Limiting & Abuse Prevention',
    icon: '⚡',
    items: [
      {
        title: 'Sliding-window rate limiting on all API routes',
        detail:
          'Every API endpoint has a per-company rate limit enforced server-side with a sliding window algorithm. Endpoints that call external AI APIs (fingerprinting, batch scoring) have tighter limits to prevent cost abuse.',
      },
      {
        title: 'Authentication rate limiting by IP',
        detail:
          'Login and signup attempts are limited to 10 per 15 minutes per IP address. Exceeding this triggers a 2× window hard-block to slow brute-force attacks.',
      },
      {
        title: 'File upload limits',
        detail:
          'CSV imports are capped at 5 MB per file and 500 rows per upload. File extensions and content are validated before processing.',
      },
      {
        title: 'AI API cost protection',
        detail:
          'Calls to the Claude API are gated behind rate limits (200 fingerprints/hour, 30 batch runs/hour per company) to prevent runaway spend from bugs or abuse.',
      },
    ],
  },
  {
    category: 'Input Validation & Sanitization',
    icon: '🧹',
    items: [
      {
        title: 'HTML stripping on all user input',
        detail:
          'All free-text fields (names, notes, titles) are stripped of HTML tags and control characters before storage, preventing stored XSS.',
      },
      {
        title: 'URL validation with SSRF prevention',
        detail:
          'URLs submitted by users (LinkedIn profiles, apply links) are validated for http/https scheme only. Private and loopback addresses (localhost, 192.168.x.x, 10.x.x.x) are rejected to prevent Server-Side Request Forgery.',
      },
      {
        title: 'Prompt injection detection',
        detail:
          'Text fields that feed into AI prompts are scanned for known prompt injection patterns ("ignore previous instructions", jailbreak attempts) before being sent to Claude. Detected attempts are replaced with a safe placeholder and logged.',
      },
      {
        title: 'Schema validation with Zod',
        detail:
          'API request bodies are validated against strict Zod schemas. Unknown fields are stripped. Type coercion is minimal and explicit.',
      },
    ],
  },
  {
    category: 'Data Privacy & Storage',
    icon: '🗄️',
    items: [
      {
        title: 'Data encrypted at rest',
        detail:
          'All data is stored in Supabase (PostgreSQL on AWS). AWS encrypts all data at rest using AES-256 by default. Database backups are also encrypted.',
      },
      {
        title: 'Candidate data isolation',
        detail:
          'Candidate records are partitioned by company_id at the database level. No cross-company data access is possible at the query layer even without RLS.',
      },
      {
        title: 'No candidate data shared with third parties',
        detail:
          'Candidate profile text is sent to Anthropic\'s Claude API for fingerprint extraction only. No data is sold, shared, or used to train models. API calls are governed by Anthropic\'s commercial data processing terms.',
      },
      {
        title: 'Secrets management',
        detail:
          'All API keys and database credentials are stored as environment variables in Vercel. No secrets are committed to the repository. The repository is public but contains no credentials.',
      },
    ],
  },
  {
    category: 'AI Safety',
    icon: '🤖',
    items: [
      {
        title: 'Structured output with strict validation',
        detail:
          "Claude's responses are parsed as JSON and validated against a strict schema. Invalid or unexpected output is rejected — it never reaches the database or UI.",
      },
      {
        title: 'Prompt injection guards on candidate-supplied content',
        detail:
          'Candidate names, titles, notes, and skills are sanitized before inclusion in AI prompts. Detected injection attempts are blocked and replaced.',
      },
      {
        title: 'Model pinned to specific version',
        detail:
          'The Claude model version (claude-haiku-4-5-20251001) is pinned explicitly. Automatic model upgrades cannot introduce unexpected behaviour changes.',
      },
    ],
  },
  {
    category: 'Operational Security',
    icon: '🔧',
    items: [
      {
        title: 'Build-time secret safety',
        detail:
          'All external SDK clients (Anthropic, Supabase service role, Razorpay) use fallback placeholder values at build time so the build never fails due to missing secrets. Secrets are only needed at runtime.',
      },
      {
        title: 'No wildcard image domains',
        detail:
          'next/image remote patterns are restricted to known hostnames (Supabase storage, LinkedIn, Google). Wildcard (*) is not used, preventing image proxying from arbitrary origins.',
      },
      {
        title: 'Dependency audit',
        detail:
          'Production dependencies are kept minimal. The package.json is reviewed on each major feature addition. npm audit is run in CI.',
      },
    ],
  },
]

export default function SecurityPage() {
  return (
    <main style={{ fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)', background: '#F7F6F3', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E4E0', padding: '48px 24px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Trust &amp; Security
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1a1a1a', marginBottom: 16, lineHeight: 1.2 }}>
            Security at Quorbit Pulse
          </h1>
          <p style={{ fontSize: 16, color: '#555', lineHeight: 1.7, marginBottom: 24 }}>
            Quorbit Pulse handles sensitive hiring data. This page documents the security
            controls we have implemented across authentication, transport, data storage,
            AI safety, and operational security.
          </p>
          <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['HTTPS / TLS 1.2+', 'RLS enforced', 'Rate limited', 'CSP headers', 'AES-256 at rest'].map(tag => (
              <span key={tag} style={{ background: '#F0EEF9', color: '#5B21B6', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99 }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px 80px' }}>
        {CONTROLS.map(section => (
          <section key={section.category} style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 22 }}>{section.icon}</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{section.category}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {section.items.map(item => (
                <div key={item.title} style={{ background: '#fff', border: '1px solid #E5E4E0', borderRadius: 12, padding: '16px 20px' }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', marginBottom: 6 }}>
                    ✓ {item.title}
                  </p>
                  <p style={{ fontSize: 13, color: '#555', lineHeight: 1.65, margin: 0 }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Responsible Disclosure */}
        <section style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, padding: '24px 28px', marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#9A3412', marginBottom: 8 }}>
            🔍 Responsible Disclosure
          </h2>
          <p style={{ fontSize: 13, color: '#7C2D12', lineHeight: 1.65, margin: 0 }}>
            If you discover a security vulnerability in Quorbit Pulse, please report it
            privately to <strong>security@thequorbit.com</strong>. We will acknowledge
            receipt within 48 hours and aim to resolve critical issues within 7 days.
            Please do not publicly disclose vulnerabilities before we have had a chance
            to address them. We do not currently offer a bug bounty programme, but we
            recognise and appreciate responsible disclosure.
          </p>
        </section>

        {/* Last updated */}
        <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
          Last updated: June 2026 · Quorbit Technologies Pvt Ltd
        </p>
      </div>
    </main>
  )
}
