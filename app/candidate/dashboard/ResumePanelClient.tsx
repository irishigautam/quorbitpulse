'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateProfile } from '@/types'

export default function ResumePanelClient({ candidate }: { candidate: CandidateProfile }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [resumeResult, setResumeResult] = useState<any>(null)
  const [resumeError, setResumeError] = useState('')
  const [viewingResume, setViewingResume] = useState(false)

  async function viewMyResume() {
    setViewingResume(true)
    try {
      const res = await fetch('/api/candidate/resume-url')
      const data = await res.json()
      if (!res.ok) { setResumeError(data.error ?? 'No resume available'); return }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setViewingResume(false)
    }
  }

  const [linkedinUrl, setLinkedinUrl] = useState(candidate.linkedin_url ?? '')
  const [savingUrl, setSavingUrl] = useState(false)
  const [urlSaved, setUrlSaved] = useState(!!candidate.linkedin_url)
  const [urlError, setUrlError] = useState('')

  // Self-service AI work history upload — candidate uploads their own
  // ChatGPT/Claude export to enrich their fingerprint. No consent gate
  // needed (unlike the recruiter-initiated version) since it's their own data.
  const [llmUploading, setLlmUploading] = useState(false)
  const [llmResult, setLlmResult] = useState<any>(null)
  const [llmError, setLlmError] = useState('')

  // P0-010 / P0-011 — profile was entirely read-only beyond resume re-upload
  // and the LinkedIn URL field. This lets a candidate correct a bad AI parse
  // or edit their basic identity fields.
  const [editing, setEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [editForm, setEditForm] = useState({
    full_name: candidate.full_name ?? '',
    location: candidate.location ?? '',
    current_title: candidate.current_title ?? '',
    current_company: candidate.current_company ?? '',
    skills: (candidate.skills ?? []).join(', '),
    domain: (candidate.domain ?? []).join(', '),
    seniority: candidate.seniority ?? '',
    years_experience: candidate.years_experience?.toString() ?? '',
    portfolio_url: candidate.portfolio_url ?? '',
    github_url: candidate.github_url ?? '',
  })

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileError('')

    const res = await fetch('/api/candidate/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: editForm.full_name,
        location: editForm.location,
        current_title: editForm.current_title,
        current_company: editForm.current_company,
        skills: editForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        domain: editForm.domain.split(',').map(d => d.trim()).filter(Boolean),
        seniority: editForm.seniority || null,
        years_experience: editForm.years_experience === '' ? null : Number(editForm.years_experience),
        portfolio_url: editForm.portfolio_url,
        github_url: editForm.github_url,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setProfileError(data.error ?? 'Failed to save')
    } else {
      setEditing(false)
      router.refresh()
    }
    setSavingProfile(false)
  }

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

    if (!res.ok) {
      setResumeError(data.error ?? 'Upload failed')
    } else {
      setResumeResult(data.fingerprint)
      // Resume upload flips status incomplete → active server-side; refresh
      // the (server-rendered, force-dynamic) dashboard so the onboarding
      // checklist, public profile link, and status banner all pick it up.
      router.refresh()
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleSaveLinkedInUrl() {
    if (!linkedinUrl.trim()) return
    setSavingUrl(true)
    setUrlError('')

    const res = await fetch('/api/candidate/save-linkedin-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedin_url: linkedinUrl.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUrlError(data.error ?? 'Could not save URL')
    } else {
      setUrlSaved(true)
    }
    setSavingUrl(false)
  }

  async function handleLlmUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLlmUploading(true)
    setLlmError('')
    setLlmResult(null)

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/candidate/upload-llm-export', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      setLlmError(data.error ?? 'Upload failed')
    } else {
      setLlmResult(data)
      router.refresh()
    }
    setLlmUploading(false)
    e.target.value = ''
  }

  const hasResume = !!candidate.resume_processed_at

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '1.25rem',
      position: 'sticky',
      top: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
          Resume & Profile
        </h3>
        <button
          onClick={() => setEditing(e => !e)}
          style={{
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {editing ? 'Cancel' : '✎ Edit'}
        </button>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
          {([
            ['full_name', 'Full name', 'text'],
            ['location', 'Location', 'text'],
            ['current_title', 'Current title', 'text'],
            ['current_company', 'Current company', 'text'],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>{label}</div>
              <input
                value={(editForm as any)[key]}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Skills (comma-separated)</div>
            <input
              value={editForm.skills}
              onChange={e => setEditForm(f => ({ ...f, skills: e.target.value }))}
              placeholder="React, Python, SQL"
              style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Domain (comma-separated)</div>
            <input
              value={editForm.domain}
              onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="Fintech, Healthcare"
              style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Portfolio URL</div>
            <input
              type="url" value={editForm.portfolio_url}
              onChange={e => setEditForm(f => ({ ...f, portfolio_url: e.target.value }))}
              placeholder="https://yourname.dev"
              style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>GitHub URL</div>
            <input
              type="url" value={editForm.github_url}
              onChange={e => setEditForm(f => ({ ...f, github_url: e.target.value }))}
              placeholder="https://github.com/yourname"
              style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Level</div>
              <select
                value={editForm.seniority}
                onChange={e => setEditForm(f => ({ ...f, seniority: e.target.value }))}
                style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px' }}
              >
                <option value="">—</option>
                {['intern', 'junior', 'mid', 'senior', 'lead', 'principal'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '2px' }}>Years experience</div>
              <input
                type="number" min={0} max={60}
                value={editForm.years_experience}
                onChange={e => setEditForm(f => ({ ...f, years_experience: e.target.value }))}
                style={{ width: '100%', fontSize: '0.82rem', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: '6px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {profileError && <p style={{ color: '#EF4444', fontSize: '0.78rem' }}>{profileError}</p>}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            style={{
              fontSize: '0.82rem', fontWeight: 600, padding: '7px', borderRadius: '6px',
              background: 'var(--primary)', color: '#fff', border: 'none',
              cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.7 : 1,
            }}
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      ) : (
      <>
      {/* Skills chips */}
      {candidate.skills?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.skills.slice(0, 15).map(s => (
              <span key={s} style={{
                fontSize: '0.75rem', background: '#EEF2FF', color: '#3730A3',
                padding: '2px 8px', borderRadius: '999px',
              }}>
                {s}
              </span>
            ))}
            {candidate.skills.length > 15 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', padding: '2px 4px' }}>
                +{candidate.skills.length - 15} more
              </span>
            )}
          </div>
        </div>
      )}

      {candidate.domain?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Domain</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.domain.map(d => (
              <span key={d} style={{
                fontSize: '0.75rem', background: '#F0FDF4', color: '#065F46',
                padding: '2px 8px', borderRadius: '999px',
              }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.seniority && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--muted)' }}>Level: </span>
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{candidate.seniority}</span>
          {candidate.years_experience !== null && (
            <span style={{ color: 'var(--muted)' }}> · {candidate.years_experience} yrs</span>
          )}
        </div>
      )}

      {(candidate.current_title || candidate.current_company || candidate.location) && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
          {[candidate.current_title, candidate.current_company, candidate.location].filter(Boolean).join(' · ')}
        </div>
      )}

      {(candidate.portfolio_url || candidate.github_url) && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '10px', fontSize: '0.8rem' }}>
          {candidate.portfolio_url && (
            <a href={candidate.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
              🔗 Portfolio
            </a>
          )}
          {candidate.github_url && (
            <a href={candidate.github_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
              GitHub
            </a>
          )}
        </div>
      )}

      {/* Projects / Certs badge row */}
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
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {candidate.fingerprint_summary}
        </p>
      )}
      </>
      )}

      {/* ── Resume upload ── */}
      <label style={{
        display: 'block',
        textAlign: 'center',
        padding: '0.6rem',
        border: '1.5px dashed var(--border)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        color: 'var(--primary)',
        marginTop: '0.5rem',
      }}>
        {uploading ? 'Parsing resume…' : hasResume ? '↑ Re-upload resume (PDF)' : '↑ Upload resume (PDF)'}
        <input
          type="file" accept=".pdf" onChange={handleUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
      </label>

      {hasResume && candidate.resume_file_path && (
        <button
          onClick={viewMyResume}
          disabled={viewingResume}
          style={{
            display: 'block', marginTop: '0.5rem', fontSize: '0.78rem', fontWeight: 600,
            color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          {viewingResume ? 'Opening…' : '📄 View my resume'}
        </button>
      )}

      {resumeError && <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{resumeError}</p>}

      {resumeResult && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: '8px', fontSize: '0.8rem' }}>
          <strong style={{ color: '#065F46' }}>✓ Profile live</strong>
          <p style={{ margin: '4px 0 0', color: '#374151' }}>
            {resumeResult.skills?.length ?? 0} skills · {resumeResult.domain?.length ?? 0} domains extracted. You're now matched against open roles.
          </p>
        </div>
      )}

      {/* ── LinkedIn URL ── */}
      <div style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#0A66C2">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a' }}>
            {urlSaved ? 'LinkedIn URL saved ✓' : 'LinkedIn profile'}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)',
            background: '#F3F4F6', padding: '1px 6px', borderRadius: '999px',
          }}>
            Optional
          </span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.5 }}>
          Doesn't affect your score — profile enrichment coming soon.
        </p>

        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="url"
            value={linkedinUrl}
            onChange={e => { setLinkedinUrl(e.target.value); setUrlSaved(false) }}
            placeholder="https://linkedin.com/in/yourname"
            disabled={savingUrl}
            style={{
              flex: 1,
              fontSize: '0.8rem',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            onClick={handleSaveLinkedInUrl}
            disabled={savingUrl || !linkedinUrl.trim() || urlSaved}
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              padding: '6px 12px',
              background: (savingUrl || !linkedinUrl.trim() || urlSaved) ? '#E5E7EB' : '#0A66C2',
              color: (savingUrl || !linkedinUrl.trim() || urlSaved) ? '#9CA3AF' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: (savingUrl || !linkedinUrl.trim() || urlSaved) ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {savingUrl ? 'Saving…' : urlSaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        {urlError && (
          <p style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '6px' }}>{urlError}</p>
        )}
      </div>

      {/* ── AI work history (self-service ChatGPT/Claude export) ── */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a' }}>
            {candidate.llm_export_processed_at ? 'AI work history uploaded ✓' : 'AI work history'}
          </span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)',
            background: '#F3F4F6', padding: '1px 6px', borderRadius: '999px',
          }}>
            Optional
          </span>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.5 }}>
          Upload your own ChatGPT or Claude export to surface skills your resume might miss.
          Personal conversations are filtered out automatically — only work-relevant content is analysed.
        </p>

        <label style={{
          display: 'block',
          textAlign: 'center',
          padding: '0.6rem',
          border: '1.5px dashed var(--border)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: 'var(--primary)',
        }}>
          {llmUploading ? 'Analysing…' : candidate.llm_export_processed_at ? '↑ Upload a newer export' : '↑ Upload export (.json)'}
          <input
            type="file" accept=".json" onChange={handleLlmUpload}
            disabled={llmUploading}
            style={{ display: 'none' }}
          />
        </label>

        {llmError && <p style={{ color: '#EF4444', fontSize: '0.78rem', marginTop: '6px' }}>{llmError}</p>}

        {llmResult && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: '8px', fontSize: '0.8rem' }}>
            <strong style={{ color: '#065F46' }}>✓ Profile enriched</strong>
            <p style={{ margin: '4px 0 0', color: '#374151' }}>
              {llmResult.workRelevant} of {llmResult.classified} conversations were work-relevant ·{' '}
              {llmResult.extracted?.skills?.length ?? 0} new skills found.
            </p>
          </div>
        )}

        {!llmResult && candidate.llm_export_source && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px' }}>
            Last upload: {candidate.llm_export_source} export
            {candidate.llm_export_processed_at ? `, ${new Date(candidate.llm_export_processed_at).toLocaleDateString()}` : ''}
          </p>
        )}
      </div>

      {/* ── CTA ── */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <a
          href="/candidate/jobs"
          style={{
            display: 'block', textAlign: 'center',
            background: 'var(--primary)', color: '#fff',
            borderRadius: '6px', padding: '0.6rem',
            fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Browse matched jobs →
        </a>
      </div>
    </div>
  )
}
