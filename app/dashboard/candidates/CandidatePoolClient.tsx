'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ImportedCandidate } from '@/types'
import type { ScoreBreakdown } from '@/lib/scoring/engine'

interface Props {
  initialCandidates: ImportedCandidate[]
  activeJobs: { id: string; title: string }[]
  total: number
}

const SOURCE_LABELS: Record<string, string> = {
  csv: 'CSV',
  linkedin_ext: 'LinkedIn',
  apollo: 'Apollo',
  naukri_ext: 'Naukri',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:         { bg: '#F3F4F6', text: '#374151', label: 'New' },
  scored:      { bg: '#EFF6FF', text: '#1D4ED8', label: 'Scored' },
  chatted:     { bg: '#F0FDF4', text: '#15803D', label: 'Chatted' },
  in_pipeline: { bg: '#FFF7ED', text: '#C2410C', label: 'In pipeline' },
  rejected:    { bg: '#FEF2F2', text: '#991B1B', label: 'Rejected' },
  hired:       { bg: '#DCFCE7', text: '#14532D', label: 'Hired' },
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
  }
  let bg = '#FEF2F2', color = '#991B1B'
  if (score >= 80) { bg = '#DCFCE7'; color = '#14532D' }
  else if (score >= 60) { bg = '#EFF6FF'; color = '#1D4ED8' }
  else if (score >= 40) { bg = '#FEF3C7'; color = '#92400E' }
  return (
    <span
      className="inline-flex items-center justify-center w-12 h-7 rounded-lg text-xs font-bold tabular-nums"
      style={{ background: bg, color }}
    >
      {score}
    </span>
  )
}

function ScoreBreakdownPanel({
  breakdown,
  onClose,
}: {
  breakdown: ScoreBreakdown
  onClose: () => void
}) {
  const rows = [
    { label: 'Domain match', score: breakdown.domain_score, max: 30,
      detail: breakdown.domain_match_type === 'exact' ? 'Exact match'
        : breakdown.domain_match_type === 'adjacent' ? 'Adjacent domain'
        : 'No domain overlap' },
    { label: 'Seniority fit', score: breakdown.seniority_score, max: 20,
      detail: breakdown.seniority_gap === 0 ? 'Exact fit'
        : `${breakdown.seniority_gap} level${breakdown.seniority_gap > 1 ? 's' : ''} apart` },
    { label: 'Skill overlap', score: breakdown.skill_score, max: 25,
      detail: `${breakdown.matched_skills.length} of ${breakdown.matched_skills.length + breakdown.missing_skills.length} required skills` },
    { label: 'Experience years', score: breakdown.yoe_score, max: 25,
      detail: breakdown.candidate_yoe !== null
        ? `${breakdown.candidate_yoe} yrs vs ${breakdown.job_min_experience} yrs required`
        : 'Unknown' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold text-base">Score breakdown</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Total: <strong>{breakdown.total}</strong> / 100
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3 mb-5">
          {rows.map(r => (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-sm font-semibold tabular-nums">{r.score} / {r.max}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-0.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${(r.score / r.max) * 100}%`, background: r.score === r.max ? '#22C55E' : r.score > 0 ? '#3B82F6' : '#E5E7EB' }}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.detail}</p>
            </div>
          ))}
        </div>

        {breakdown.missing_skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Missing skills</p>
            <div className="flex flex-wrap gap-1.5">
              {breakdown.missing_skills.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B' }}>{s}</span>
              ))}
            </div>
          </div>
        )}
        {breakdown.matched_skills.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Matched skills</p>
            <div className="flex flex-wrap gap-1.5">
              {breakdown.matched_skills.map(s => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#14532D' }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50">
          Close
        </button>
      </div>
    </div>
  )
}

export default function CandidatePoolClient({ initialCandidates, activeJobs, total }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'created_at' | 'match_score'>('match_score')
  const [assignTarget, setAssignTarget] = useState<{ candidateId: string; name: string } | null>(null)
  const [selectedJob, setSelectedJob] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [scoringJob, setScoringJob] = useState('')
  const [scoringStatus, setScoringStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [scoringProgress, setScoringProgress] = useState('')
  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null)
  const [, startTransition] = useTransition()

  const filtered = candidates
    .filter(c => {
      const q = search.toLowerCase()
      const matchesSearch = !q ||
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.current_title ?? '').toLowerCase().includes(q) ||
        (c.current_company ?? '').toLowerCase().includes(q)
      const matchesStatus = !statusFilter || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'match_score') return (b.match_score ?? -1) - (a.match_score ?? -1)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  async function handleAssign() {
    if (!assignTarget || !selectedJob) return
    setAssigning(true)
    setAssignMsg(null)
    try {
      const res = await fetch('/api/candidates/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id: assignTarget.candidateId, job_id: selectedJob }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAssignMsg({ type: 'err', text: json.error ?? 'Failed to assign' })
      } else {
        setAssignMsg({ type: 'ok', text: `${assignTarget.name} assigned` })
        startTransition(() => {
          setCandidates(prev => prev.map(c =>
            c.id === assignTarget.candidateId ? { ...c, status: 'in_pipeline' as const } : c
          ))
        })
        setTimeout(() => { setAssignTarget(null); setSelectedJob(''); setAssignMsg(null) }, 1800)
      }
    } catch {
      setAssignMsg({ type: 'err', text: 'Network error' })
    } finally {
      setAssigning(false)
    }
  }

  async function handleScoreAll() {
    if (!scoringJob) return
    setScoringStatus('running')
    setScoringProgress('Sending to AI…')
    try {
      const res = await fetch('/api/candidates/score-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: scoringJob }),
      })
      const json = await res.json()
      if (!res.ok) {
        setScoringStatus('error')
        setScoringProgress(json.error ?? 'Failed')
        return
      }
      setScoringStatus('done')
      const done = json.results?.filter((r: any) => r.status === 'done').length ?? 0
      setScoringProgress(`${done} / ${json.queued} scored`)
      const scoreMap: Record<string, number> = {}
      for (const r of json.results ?? []) {
        if (r.match_score !== undefined) scoreMap[r.candidate_id] = r.match_score
      }
      startTransition(() => {
        setCandidates(prev => prev.map(c =>
          scoreMap[c.id] !== undefined
            ? { ...c, match_score: scoreMap[c.id], status: 'scored' as const }
            : c
        ))
      })
    } catch {
      setScoringStatus('error')
      setScoringProgress('Network error')
    }
  }

  async function handleScoreOne(candidateId: string) {
    startTransition(() => {
      setCandidates(prev => prev.map(c =>
        c.id === candidateId ? { ...c, fingerprint_status: 'processing' as const } : c
      ))
    })
    try {
      const res = await fetch(`/api/candidates/${candidateId}/fingerprint`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const bestScore = json.scores?.[0]?.match_score ?? null
        startTransition(() => {
          setCandidates(prev => prev.map(c =>
            c.id === candidateId
              ? { ...c, match_score: bestScore, status: 'scored' as const, fingerprint_status: 'done' as const }
              : c
          ))
        })
      } else {
        startTransition(() => {
          setCandidates(prev => prev.map(c =>
            c.id === candidateId ? { ...c, fingerprint_status: 'failed' as const } : c
          ))
        })
      }
    } catch {
      startTransition(() => {
        setCandidates(prev => prev.map(c =>
          c.id === candidateId ? { ...c, fingerprint_status: 'failed' as const } : c
        ))
      })
    }
  }

  if (total === 0) {
    return (
      <div className="bg-white rounded-2xl border p-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </div>
        <p className="font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>No candidates yet</p>
        <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
          Import candidates from LinkedIn, Apollo, or Naukri to start scoring and ranking them.
        </p>
        <Link href="/dashboard/candidates/import"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}>
          Import your first candidates →
        </Link>
      </div>
    )
  }

  return (
    <>
      {breakdown && <ScoreBreakdownPanel breakdown={breakdown} onClose={() => setBreakdown(null)} />}

      {/* Assign modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold mb-1">Assign to job</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              Assign <strong>{assignTarget.name}</strong> to an open role to start scoring.
            </p>
            {activeJobs.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                No active jobs. <Link href="/dashboard/post" className="underline" style={{ color: 'var(--accent)' }}>Post a job first →</Link>
              </p>
            ) : (
              <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select a job…</option>
                {activeJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            )}
            {assignMsg && (
              <p className={`text-sm mb-3 ${assignMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {assignMsg.text}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={handleAssign} disabled={!selectedJob || assigning}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}>
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
              <button onClick={() => { setAssignTarget(null); setSelectedJob(''); setAssignMsg(null) }}
                className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Score-all panel */}
      <div className="bg-white rounded-2xl border p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold mb-0.5">✦ AI Score candidates</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Select a job — Claude Haiku fingerprints each candidate and scores them 0–100.
          </p>
        </div>
        <select value={scoringJob} onChange={e => { setScoringJob(e.target.value); setScoringStatus('idle'); setScoringProgress('') }}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2">
          <option value="">Select job…</option>
          {activeJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <button onClick={handleScoreAll} disabled={!scoringJob || scoringStatus === 'running'}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center gap-2"
          style={{ background: '#7C3AED' }}>
          {scoringStatus === 'running' && (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {scoringStatus === 'running' ? 'Scoring…' : 'Score all'}
        </button>
        {scoringProgress && (
          <p className={`text-xs font-medium ${scoringStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {scoringProgress}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search name, title, company…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2"/>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2">
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as 'created_at' | 'match_score')}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2">
          <option value="match_score">Best match first</option>
          <option value="created_at">Newest first</option>
        </select>
        <p className="text-sm self-center ml-auto" style={{ color: 'var(--muted)' }}>
          {filtered.length} of {total}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: '#FAFAFA' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Candidate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Role / Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  Score <span style={{ color: '#7C3AED' }}>✦</span>
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    No candidates match your search.
                  </td>
                </tr>
              ) : filtered.map(c => {
                const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.new
                const hasBreakdown = c.score_breakdown && typeof c.score_breakdown === 'object'
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.full_name}</p>
                      {c.email && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.email}</p>}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>LinkedIn ↗</a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{c.current_title ?? '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.current_company ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{c.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#374151' }}>
                        {SOURCE_LABELS[c.import_source] ?? c.import_source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.fingerprint_status === 'processing' ? (
                        <span className="text-xs animate-pulse" style={{ color: '#7C3AED' }}>Scoring…</span>
                      ) : hasBreakdown ? (
                        <button onClick={() => setBreakdown(c.score_breakdown as unknown as ScoreBreakdown)}
                          className="group relative" title="View breakdown">
                          <ScoreBadge score={c.match_score} />
                        </button>
                      ) : (
                        <ScoreBadge score={c.match_score} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.fingerprint_status !== 'processing' && c.status !== 'scored' && (
                          <button onClick={() => handleScoreOne(c.id)}
                            className="text-xs px-2.5 py-1.5 border rounded-lg hover:bg-purple-50 font-medium"
                            style={{ color: '#7C3AED', borderColor: '#7C3AED' }}>
                            ✦ Score
                          </button>
                        )}
                        <button onClick={() => setAssignTarget({ candidateId: c.id, name: c.full_name })}
                          className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 font-medium"
                          style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                          Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && filtered.length < total && (
          <div className="px-4 py-3 border-t text-center">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Showing {filtered.length} of {total} candidates.{' '}
              <Link href="/dashboard/candidates/import" className="underline" style={{ color: 'var(--accent)' }}>
                Import more →
              </Link>
            </p>
          </div>
        )}
      </div>
    </>
  )
}
