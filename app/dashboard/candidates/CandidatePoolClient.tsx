'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ImportedCandidate } from '@/types'

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

export default function CandidatePoolClient({ initialCandidates, activeJobs, total }: Props) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [assignTarget, setAssignTarget] = useState<{ candidateId: string; name: string } | null>(null)
  const [selectedJob, setSelectedJob] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [, startTransition] = useTransition()

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.current_title ?? '').toLowerCase().includes(q) ||
      (c.current_company ?? '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter || c.status === statusFilter
    return matchesSearch && matchesStatus
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
        setAssignMsg({ type: 'ok', text: `${assignTarget.name} assigned to job` })
        // Update local status
        startTransition(() => {
          setCandidates(prev =>
            prev.map(c => c.id === assignTarget.candidateId ? { ...c, status: 'in_pipeline' as const } : c)
          )
        })
        setTimeout(() => { setAssignTarget(null); setSelectedJob(''); setAssignMsg(null) }, 1800)
      }
    } catch {
      setAssignMsg({ type: 'err', text: 'Network error' })
    } finally {
      setAssigning(false)
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
        <Link
          href="/dashboard/candidates/import"
          className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Import your first candidates →
        </Link>
      </div>
    )
  }

  return (
    <>
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
              <select
                value={selectedJob}
                onChange={e => setSelectedJob(e.target.value)}
                className="w-full border rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Select a job…</option>
                {activeJobs.map(j => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            )}

            {assignMsg && (
              <p className={`text-sm mb-3 ${assignMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                {assignMsg.text}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleAssign}
                disabled={!selectedJob || assigning}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
              <button
                onClick={() => { setAssignTarget(null); setSelectedJob(''); setAssignMsg(null) }}
                className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search name, title, company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
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
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Score</th>
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
              ) : (
                filtered.map(c => {
                  const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.new
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.full_name}</p>
                        {c.email && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.email}</p>
                        )}
                        {c.linkedin_url && (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs hover:underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            LinkedIn ↗
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{c.current_title ?? '—'}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.current_company ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                        {c.location ?? '—'}
                      </td>
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
                        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                          — {/* Phase 2 */}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setAssignTarget({ candidateId: c.id, name: c.full_name })}
                          className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 font-medium"
                          style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        >
                          Assign to job
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
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
