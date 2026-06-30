/**
 * Public company profile page.
 * /company/[slug] — no auth required.
 * Shows company info + all active job listings.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createServiceClient()
  const { data: company } = await supabase
    .from('companies')
    .select('name, description, website')
    .eq('slug', params.slug)
    .single()

  if (!company) return { title: 'Company Not Found' }

  return {
    title: `${company.name} — Jobs on Pulse`,
    description: company.description ?? `Browse open roles at ${company.name}.`,
    openGraph: {
      title: `${company.name} is hiring`,
      description: company.description ?? `See open roles at ${company.name}.`,
    },
  }
}

export default async function CompanyPublicPage({ params }: Props) {
  const supabase = createServiceClient()

  const { data: company } = await supabase
    .from('companies')
    .select('id, name, slug, website, logo_url, description, verified, created_at')
    .eq('slug', params.slug)
    .single()

  if (!company) notFound()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, location, job_type, remote, salary_min, salary_max, salary_currency, skills, posted_at, expires_at')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString())
    .order('posted_at', { ascending: false })

  const openJobs = jobs ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB' }}>
      {/* Nav */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none', color: 'var(--navy)' }}>
          Pulse
        </Link>
        <Link href="/candidate/jobs" style={{ fontSize: '0.875rem', color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>
          Browse all jobs →
        </Link>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Company header */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
            {/* Logo / avatar */}
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: company.logo_url ? 'transparent' : '#EEF2FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              fontWeight: 700,
              color: '#4338CA',
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              {company.logo_url
                ? <img src={company.logo_url} alt={company.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : company.name.charAt(0).toUpperCase()
              }
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>
                  {company.name}
                </h1>
                {company.verified && (
                  <span style={{ fontSize: '0.75rem', background: '#DCFCE7', color: '#166534', padding: '2px 10px', borderRadius: 999, fontWeight: 600 }}>
                    ✓ Verified
                  </span>
                )}
              </div>

              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.875rem', color: 'var(--accent)', textDecoration: 'none', marginTop: '0.25rem', display: 'inline-block' }}
                >
                  {company.website.replace(/^https?:\/\//, '')} ↗
                </a>
              )}

              {company.description && (
                <p style={{ fontSize: '0.9rem', color: '#374151', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  {company.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Jobs list */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0 }}>
            Open Roles
            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--muted)', marginLeft: '0.5rem' }}>
              ({openJobs.length})
            </span>
          </h2>
        </div>

        {openJobs.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
            No open roles at the moment. Check back soon.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {openJobs.map(job => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '1.125rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{job.title}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>📍 {job.location}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>·</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'capitalize' }}>
                        {job.job_type?.replace('_', ' ')}
                      </span>
                      {job.remote && <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>· Remote</span>}
                    </div>
                    {(job.skills ?? []).length > 0 && (
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {(job.skills as string[]).slice(0, 4).map(s => (
                          <span key={s} style={{ fontSize: '0.72rem', background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: 999 }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {job.salary_min && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
                        {job.salary_currency}{job.salary_min.toLocaleString()}
                        {job.salary_max ? `–${job.salary_max.toLocaleString()}` : '+'}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2rem' }}>
          Powered by{' '}
          <a href="https://thequorbit.com" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Quorbit
          </a>
        </p>
      </main>
    </div>
  )
}
