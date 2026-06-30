/**
 * c4 — Candidate public profile (shareable, anonymised).
 * Accessible at /candidate/profile/[slug] without auth.
 * Shows: title, skills, domain, seniority, YOE, summary. Hides email/phone.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CandidatePublicProfile({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient()

  const { data: candidate } = await supabase
    .from('candidate_profiles')
    .select('full_name, current_title, current_company, location, skills, domain, seniority, years_experience, fingerprint_summary, public_slug, status, created_at')
    .eq('public_slug', params.slug)
    .eq('status', 'active')
    .single()

  if (!candidate) notFound()

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      {/* Header card */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.75rem' }}>
              {candidate.full_name.charAt(0)}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: 0 }}>{candidate.full_name}</h1>
            {candidate.current_title && (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                {candidate.current_title}
                {candidate.current_company ? ` at ${candidate.current_company}` : ''}
              </p>
            )}
            {candidate.location && (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '2px' }}>📍 {candidate.location}</p>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            {candidate.seniority && (
              <span style={{ display: 'inline-block', textTransform: 'capitalize', fontWeight: 600, color: '#4F46E5', background: '#EEF2FF', padding: '3px 10px', borderRadius: '999px' }}>
                {candidate.seniority}
              </span>
            )}
            {candidate.years_experience !== null && (
              <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{candidate.years_experience} years exp.</div>
            )}
          </div>
        </div>

        {candidate.fingerprint_summary && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', lineHeight: 1.6, color: '#374151', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            {candidate.fingerprint_summary}
          </p>
        )}
      </div>

      {/* Skills */}
      {(candidate.skills ?? []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {candidate.skills.map((s: string) => (
              <span key={s} style={{ fontSize: '0.82rem', background: '#EEF2FF', color: '#3730A3', padding: '4px 10px', borderRadius: '999px', fontWeight: 500 }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Domain */}
      {(candidate.domain ?? []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {candidate.domain.map((d: string) => (
              <span key={d} style={{ fontSize: '0.82rem', background: '#F0FDF4', color: '#065F46', padding: '4px 10px', borderRadius: '999px', fontWeight: 500 }}>
                {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA for recruiters */}
      <div style={{ background: '#F8FAFF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '1.25rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '0.75rem' }}>
          Interested in this candidate? Reach out via Quorbit.
        </p>
        <a
          href="/onboarding/signup"
          style={{ background: 'var(--primary)', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
        >
          Sign up as a recruiter →
        </a>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1.5rem' }}>
        Quorbit candidate profile · {candidate.public_slug}
      </p>
    </div>
  )
}
