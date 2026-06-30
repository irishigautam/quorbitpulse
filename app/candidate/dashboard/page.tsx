/**
 * c3 — Candidate private dashboard.
 * Shows applied jobs, pipeline stage per application, match scores.
 * Also allows resume upload (c2) and profile editing.
 */

import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'
import ResumePanelClient from './ResumePanelClient'

export const dynamic = 'force-dynamic'

export default async function CandidateDashboardPage() {
  const { candidate } = await requireCandidate()
  const supabase = createServiceClient()

  // Fetch applications with job + company details
  const { data: applications } = await supabase
    .from('candidate_applications')
    .select(`
      id, status, match_score, applied_at,
      job:jobs(id, title, location, job_type, remote,
        company:companies(id, name, logo_url)
      )
    `)
    .eq('candidate_id', candidate.id)
    .order('applied_at', { ascending: false })

  const stageColors: Record<string, string> = {
    pending:     '#F3F4F6',
    viewed:      '#DBEAFE',
    shortlisted: '#D1FAE5',
    rejected:    '#FEE2E2',
  }
  const stageText: Record<string, string> = {
    pending:     '#374151',
    viewed:      '#1E40AF',
    shortlisted: '#065F46',
    rejected:    '#991B1B',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0 }}>
            Hi, {candidate.full_name.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Your Quorbit candidate dashboard
          </p>
        </div>
        <a
          href={`/candidate/profile/${candidate.public_slug}`}
          style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid var(--primary)', borderRadius: '6px' }}
        >
          View public profile →
        </a>
      </div>

      {/* Profile completeness */}
      {candidate.status === 'incomplete' && (
        <div style={{ background: '#FEF9C3', border: '1px solid #EAB308', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <strong>Complete your profile</strong> — upload your resume to get matched with jobs.
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

        {/* Applications */}
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
            Applications ({(applications ?? []).length})
          </h2>

          {(applications ?? []).length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No applications yet. <a href="/candidate/jobs" style={{ color: 'var(--primary)' }}>Browse jobs →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(applications ?? []).map((app: any) => (
                <div key={app.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{app.job?.title ?? 'Unknown Role'}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>
                        {app.job?.company?.name ?? ''} · {app.job?.location ?? ''}
                        {app.job?.remote ? ' · Remote' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {app.match_score !== null && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4F46E5' }}>
                          {app.match_score}%
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '2px 10px',
                        borderRadius: '999px',
                        background: stageColors[app.status] ?? '#F3F4F6',
                        color: stageText[app.status] ?? '#374151',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px' }}>
                    Applied {new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resume panel */}
        <ResumePanelClient candidate={candidate} />
      </div>
    </div>
  )
}
