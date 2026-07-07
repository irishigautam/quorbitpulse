'use client'

import { useState } from 'react'

const SOURCE_LABEL: Record<string, string> = {
  adzuna:      'Adzuna',
  serpapi:     'Google Jobs',
  remotive:    'Remotive',
  arbeitnow:   'Arbeitnow',
  jobicy:      'Jobicy',
  career_page: 'Company site',
  direct:      '',
}

interface JobCard {
  id: string
  title: string
  location: string
  job_type: string
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  skills: string[]
  domain: string[]
  min_experience: number | null
  posted_at: string | null
  company: { id: string | null; name: string; logo_url: string | null } | null
  match_score: number
  external_url: string | null   // set for scraped jobs; null for company-posted
  source: string
}

const scoreColor = (s: number) =>
  s >= 75 ? '#10B981' : s >= 50 ? '#3B82F6' : s >= 25 ? '#F59E0B' : '#9CA3AF'

export default function JobFeedClient({ jobs, candidateId }: { jobs: JobCard[]; candidateId: string }) {
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = jobs.filter(j =>
    !search ||
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.location.toLowerCase().includes(search.toLowerCase()) ||
    (j.company?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function apply(jobId: string, companyId: string) {
    if (applied.has(jobId) || applying === jobId) return
    setApplying(jobId)
    const res = await fetch('/api/candidate/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, company_id: companyId }),
    })
    if (res.ok) setApplied(prev => new Set([...prev, jobId]))
    setApplying(null)
  }

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter by title, company, or location…"
        style={{ width: '100%', padding: '0.6rem 0.9rem', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1.25rem', boxSizing: 'border-box' }}
      />

      {filtered.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem 0' }}>No jobs match your filter.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map(job => (
          <div key={job.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            {/* Match score pill */}
            <div style={{ flexShrink: 0, width: '52px', height: '52px', borderRadius: '10px', background: `${scoreColor(job.match_score)}20`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: scoreColor(job.match_score) }}>{job.match_score}</span>
              <span style={{ fontSize: '0.6rem', color: scoreColor(job.match_score), opacity: 0.8 }}>match</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{job.title}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>
                    {job.company?.name ?? ''} · {job.location}
                    {job.remote ? ' · Remote' : ''}
                    {job.min_experience !== null ? ` · ${job.min_experience}+ yrs` : ''}
                  </div>
                </div>

                {/* External scraped job: open URL in new tab */}
                {job.external_url ? (
                  <a
                    href={job.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0,
                      marginLeft: '0.75rem',
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      background: '#F3F4F6',
                      color: '#374151',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    View Job →
                  </a>
                ) : (
                  /* Company-posted job: in-app quick apply */
                  <button
                    onClick={() => apply(job.id, job.company?.id ?? '')}
                    disabled={applied.has(job.id) || applying === job.id}
                    style={{
                      flexShrink: 0,
                      marginLeft: '0.75rem',
                      padding: '0.45rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: applied.has(job.id) ? 'default' : 'pointer',
                      background: applied.has(job.id) ? '#D1FAE5' : 'var(--primary)',
                      color: applied.has(job.id) ? '#065F46' : '#fff',
                    }}
                  >
                    {applied.has(job.id) ? '✓ Applied' : applying === job.id ? '…' : 'Quick Apply'}
                  </button>
                )}
              </div>

              {/* Salary */}
              {(job.salary_min ?? job.salary_max) && (
                <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '6px', fontWeight: 500 }}>
                  {job.salary_currency} {job.salary_min?.toLocaleString('en-IN') ?? '?'} – {job.salary_max?.toLocaleString('en-IN') ?? '?'} / yr
                </div>
              )}

              {/* Skills */}
              {(job.skills ?? []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                  {job.skills.slice(0, 6).map(s => (
                    <span key={s} style={{ fontSize: '0.72rem', background: '#EEF2FF', color: '#3730A3', padding: '2px 7px', borderRadius: '999px' }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Source badge for external jobs */}
              {job.source && job.source !== 'direct' && SOURCE_LABEL[job.source] && (
                <div style={{ marginTop: '6px' }}>
                  <span style={{ fontSize: '0.68rem', background: '#F9FAFB', color: '#6B7280', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                    via {SOURCE_LABEL[job.source]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
