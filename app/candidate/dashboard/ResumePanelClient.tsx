'use client'

import { useState } from 'react'
import type { CandidateProfile } from '@/types'

export default function ResumePanelClient({ candidate }: { candidate: CandidateProfile }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    setResult(null)

    const fd = new FormData()
    fd.append('resume', file)

    const res = await fetch('/api/candidate/resume', { method: 'POST', body: fd })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Upload failed')
    } else {
      setResult(data.fingerprint)
    }
    setUploading(false)
    e.target.value = ''
  }

  const hasResume = !!candidate.resume_processed_at

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', position: 'sticky', top: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
        Resume & Skills
      </h3>

      {/* Skills chips */}
      {candidate.skills?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.skills.slice(0, 12).map(s => (
              <span key={s} style={{ fontSize: '0.75rem', background: '#EEF2FF', color: '#3730A3', padding: '2px 8px', borderRadius: '999px' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.domain?.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Domain</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {candidate.domain.map(d => (
              <span key={d} style={{ fontSize: '0.75rem', background: '#F0FDF4', color: '#065F46', padding: '2px 8px', borderRadius: '999px' }}>
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

      {candidate.fingerprint_summary && (
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
          {candidate.fingerprint_summary}
        </p>
      )}

      {/* Upload */}
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

      {error && <p style={{ color: '#EF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#F0FDF4', borderRadius: '8px', fontSize: '0.8rem' }}>
          <strong style={{ color: '#065F46' }}>✓ Resume parsed</strong>
          <p style={{ margin: '4px 0 0', color: '#374151' }}>
            {result.skills?.length ?? 0} skills · {result.domain?.length ?? 0} domains extracted
          </p>
          <p style={{ margin: '2px 0 0', color: '#6B7280' }}>Refresh to see updated profile.</p>
        </div>
      )}

      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        <a href="/candidate/jobs" style={{ display: 'block', textAlign: 'center', background: 'var(--primary)', color: '#fff', borderRadius: '6px', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
          Browse matched jobs →
        </a>
      </div>
    </div>
  )
}
