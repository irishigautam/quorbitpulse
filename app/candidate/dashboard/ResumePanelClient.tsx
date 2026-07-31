'use client'

import { useState } from 'react'
import type { CandidateProfile } from '@/types'

export default function ResumePanelClient({ candidate }: { candidate: CandidateProfile }) {
  const [uploading, setUploading] = useState(false)
  const [resumeResult, setResumeResult] = useState<any>(null)
  const [resumeError, setResumeError] = useState('')

  const [linkedinUrl, setLinkedinUrl] = useState(candidate.linkedin_url ?? '')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncError, setSyncError] = useState('')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setResumeError('')
    setResumeResult(null)
    const fd = new FormData()
    fd.append('resume', file)
    const res = await fetch('/api/candidate/resume', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) setResumeError(data.error ?? 'Upload failed')
    else setResumeResult(data.fingerprint)
    setUploading(false)
    e.target.value = ''
  }

  async function handleLinkedInSync() {
    if (!linkedinUrl.trim()) return
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)
    const res = await fetch('/api/candidate/sync-linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedinUrl.trim() }),
    })
    const data = await res.json()
    if (!res.ok) setSyncError(data.error ?? 'Sync failed')
    else setSyncResult(data.summary)
    setSyncing(false)
  }

  const hasResume = !!candidate.resume_processed_at
  const hasLinkedIn = !!candidate.linkedin_synced_at

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', position: 'sticky', top: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>Resume & Profile</h3>

      {candidate.skills?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.skills.slice(0, 15).map(s => (
              <span key={s} style={{ fontSize: '0.75rem', background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: '999px' }}>{s}</span>
            ))}
            {candidate.skills.length > 15 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', padding: '2px 4px' }}>+{candidate.skills.length - 15} more</span>
            )}
          </div>
        </div>
      )}

      {candidate.domain?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Domain</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.domain.map(d => (
              <span key={d} style={{ fontSize: '0.75rem', background: '#F0FDF4', color: '#065F46', padding: '2px 8px', borderRadius: '999px' }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {candidate.seniority && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)' }}>Level: </span>
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{candidate.seniority}</span>
          {candidate.years_experience !== null && <span style={{ color: 'var(--muted)' }}> · {candidate.years_experience} yrs</span>}
        </div>
      )}

      {(candidate.projects?.length > 0 || candidate.certifications?.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          {candidate.projects?.length > 0 && (
            <span style={{ fontSize: '0.72rem', background: '#FFF7ED', color: '#C2410C', padding: '2px 8px', borderRadius: '999px', border: '1px solid #FED7AA' }}>
              {candidate.projects.length} project{candidate.projects.length !== 1 ? 's' : ''}
            </span>
          )}
          {candidate.certifications?.length > 0 && (
            <span style={{ fontSize: '0.72rem', background: '#F0F9FF', color: '#0369A1', padding: '2px 8px', borderRadius: '999px', border: '1px solid #BAE6FD' }}>
              {candidate.certifications.length} cert{candidate.certifications.length !== 1 ? 's' : ''}
            </span>
          )}
          {candidate.publications?.length > 0 && (
            <span style={{ fontSize: '0.72rem', background: '#FDF4FF', color: '#7E22CE', padding: '2px 8px', borderRadius: '999px', border: '1px solid #E9D5FF' }}>
              {candidate.publications.length} publication{candidate.publications.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {candidate.fingerprint_summary && (
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>{candidate.fingerprint_summary}</p>
      )}

      {/* Resume upload */}
      <label style={{ display: 'block', textAlign: 'center', padding: '0.6rem', border: '1.5px dashed var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem' }}>
        {uploading ? 'Parsing resume…' : hasResume ? '↑ Re-upload resume (PDF)' : '↑ Upload resume (PDF)'}
        <input type="file" accept=".pdf" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>

      {resumeError && <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{resumeError}</p>}
      {resumeResult && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: '8px', fontSize: '0.8rem' }}>
          <strong style={{ color: '#065F46' }}>✓ Resume parsed</strong>
          <p style={{ margin: '4px 0 0', color: '#374151' }}>{resumeResult.skills?.length ?? 0} skills · {resumeResult.domain?.length ?? 0} domains extracted</p>
        </div>
      )}

      {/* LinkedIn sync */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a' }}>{hasLinkedIn ? 'LinkedIn synced ✓' : 'Sync LinkedIn profile'}</span>
        </div>
        {!hasLinkedIn && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.5 }}>Paste your LinkedIn URL — we'll pull your experience, projects, and certifications to strengthen your score.</p>
        )}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/yourname" disabled={syncing}
            style={{ flex: 1, fontSize: '0.8rem', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', outline: 'none', minWidth: 0 }}
          />
          <button
            onClick={handleLinkedInSync} disabled={syncing || !linkedinUrl.trim()}
            style={{ fontSize: '0.8rem', fontWeight: 600, padding: '6px 12px', background: (syncing || !linkedinUrl.trim()) ? '#E5E7EB' : '#0A66C2', color: (syncing || !linkedinUrl.trim()) ? '#9CA3AF' : '#fff', border: 'none', borderRadius: '6px', cursor: (syncing || !linkedinUrl.trim()) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {syncing ? 'Syncing…' : hasLinkedIn ? 'Re-sync' : 'Sync'}
          </button>
        </div>
        {syncError && (
          <p style={{ color: syncError.includes('private') ? '#92400E' : '#EF4444', fontSize: '0.78rem', marginTop: '6px', lineHeight: 1.4 }}>
            {syncError.includes('private') ? '🔒 ' : '⚠ '}{syncError}
          </p>
        )}
        {syncResult && (
          <div style={{ marginTop: '8px', padding: '10px', background: '#EFF6FF', borderRadius: '8px', fontSize: '0.78rem' }}>
            <strong style={{ color: '#1D4ED8' }}>✓ LinkedIn synced</strong>
            {syncResult.new_skills?.length > 0 && (
              <p style={{ margin: '4px 0 0', color: '#374151' }}>+{syncResult.new_skills.length} new skills: {syncResult.new_skills.slice(0, 5).join(', ')}{syncResult.new_skills.length > 5 ? ` +${syncResult.new_skills.length - 5} more` : ''}</p>
            )}
            {(syncResult.projects_found > 0 || syncResult.certifications_found > 0) && (
              <p style={{ margin: '2px 0 0', color: '#6B7280' }}>
                {[syncResult.projects_found > 0 && `${syncResult.projects_found} project${syncResult.projects_found !== 1 ? 's' : ''}`, syncResult.certifications_found > 0 && `${syncResult.certifications_found} cert${syncResult.certifications_found !== 1 ? 's' : ''}`, syncResult.publications_found > 0 && `${syncResult.publications_found} publication${syncResult.publications_found !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')} added
              </p>
            )}
            <p style={{ margin: '2px 0 0', color: '#9CA3AF' }}>Refresh to see updated profile.</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <a href="/candidate/jobs" style={{ display: 'block', textAlign: 'center', background: 'var(--primary)', color: '#fff', borderRadius: '6px', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>Browse matched jobs →</a>
      </div>
    </div>
  )
}
