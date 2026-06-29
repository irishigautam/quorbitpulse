'use client'

import { useState, useTransition } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type Stage = 'sourced' | 'screened' | 'interview' | 'offer' | 'hired' | 'rejected'

interface Candidate {
  id: string
  full_name: string
  email: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  match_score: number | null
  blended_score: number | null
}

interface Assignment {
  id: string
  pipeline_stage: Stage
  match_score: number | null
  recruiter_notes: string | null
  tags: string[]
  starred: boolean
  candidate: Candidate
}

// ── Constants ────────────────────────────────────────────────────────────────

const STAGES: { key: Stage; label: string; color: string; bg: string }[] = [
  { key: 'sourced',   label: 'Sourced',   color: '#374151', bg: '#F3F4F6' },
  { key: 'screened',  label: 'Screened',  color: '#1D4ED8', bg: '#EFF6FF' },
  { key: 'interview', label: 'Interview', color: '#92400E', bg: '#FEF3C7' },
  { key: 'offer',     label: 'Offer',     color: '#5B21B6', bg: '#F5F3FF' },
  { key: 'hired',     label: 'Hired',     color: '#14532D', bg: '#DCFCE7' },
]

const SYSTEM_TAGS = ['top-match', 'needs-followup', 'on-hold', 'strong-culture-fit', 'overqualified']

// ── Score badge ──────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return null
  let bg = '#FEF2F2', color = '#991B1B'
  if (score >= 80) { bg = '#DCFCE7'; color = '#14532D' }
  else if (score >= 60) { bg = '#EFF6FF'; color = '#1D4ED8' }
  else if (score >= 40) { bg = '#FEF3C7'; color = '#92400E' }
  return (
    <span className="inline-flex items-center justify-center w-9 h-6 rounded-md text-xs font-bold tabular-nums"
      style={{ background: bg, color }}>
      {score}
    </span>
  )
}

// ── Card detail modal ────────────────────────────────────────────────────────

function CardModal({
  assignment,
  onClose,
  onStageChange,
  onNotesChange,
  onTagsChange,
}: {
  assignment: Assignment
  onClose: () => void
  onStageChange: (stage: Stage) => void
  onNotesChange: (notes: string) => void
  onTagsChange: (tags: string[]) => void
}) {
  const [notes, setNotes] = useState(assignment.recruiter_notes ?? '')
  const [tags, setTags] = useState<string[]>(assignment.tags ?? [])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveNotes() {
    setSaving(true)
    await fetch(`/api/assignments/${assignment.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    onNotesChange(notes)
    setSaving(false)
  }

  async function toggleTag(tag: string) {
    const updated = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
    setTags(updated)
    await fetch(`/api/assignments/${assignment.id}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    })
    onTagsChange(updated)
  }

  async function addCustomTag() {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || tags.includes(tag)) { setNewTag(''); return }
    const updated = [...tags, tag]
    setTags(updated)
    setNewTag('')
    await fetch(`/api/assignments/${assignment.id}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    })
    onTagsChange(updated)
  }

  const c = assignment.candidate

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="p-5 border-b flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <p className="font-semibold text-base">{c.full_name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {c.current_title ?? '—'}{c.current_company ? ` · ${c.current_company}` : ''}
            </p>
            {c.email && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.email}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ScorePill score={c.blended_score ?? c.match_score} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage picker */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Move stage</p>
            <div className="flex flex-wrap gap-2">
              {STAGES.map(s => (
                <button key={s.key}
                  onClick={() => onStageChange(s.key)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-all"
                  style={{
                    background: assignment.pipeline_stage === s.key ? s.bg : '#fff',
                    color: assignment.pipeline_stage === s.key ? s.color : '#374151',
                    borderColor: assignment.pipeline_stage === s.key ? s.color : '#E5E7EB',
                    fontWeight: assignment.pipeline_stage === s.key ? 700 : 500,
                  }}>
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => onStageChange('rejected')}
                className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-all"
                style={{
                  background: assignment.pipeline_stage === 'rejected' ? '#FEF2F2' : '#fff',
                  color: assignment.pipeline_stage === 'rejected' ? '#991B1B' : '#374151',
                  borderColor: assignment.pipeline_stage === 'rejected' ? '#991B1B' : '#E5E7EB',
                }}>
                Rejected
              </button>
            </div>
          </div>

          {/* Tags — ats2 */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Tags</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SYSTEM_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                  style={{
                    background: tags.includes(tag) ? '#7C3AED' : '#F9FAFB',
                    color: tags.includes(tag) ? '#fff' : '#374151',
                    borderColor: tags.includes(tag) ? '#7C3AED' : '#E5E7EB',
                  }}>
                  {tag}
                </button>
              ))}
              {tags.filter(t => !SYSTEM_TAGS.includes(t)).map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className="text-xs px-2.5 py-1 rounded-full border"
                  style={{ background: '#7C3AED', color: '#fff', borderColor: '#7C3AED' }}>
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text" placeholder="Add custom tag…" value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomTag()}
                className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2"
              />
              <button onClick={addCustomTag}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50">
                Add
              </button>
            </div>
          </div>

          {/* Notes — ats5 */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Recruiter notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this candidate…"
              rows={4}
              className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
            />
            <button onClick={saveNotes} disabled={saving || notes === (assignment.recruiter_notes ?? '')}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: 'var(--accent)' }}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </div>

        <div className="p-4 border-t flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  assignment,
  onClick,
}: {
  assignment: Assignment
  onClick: () => void
}) {
  const c = assignment.candidate
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white rounded-xl border p-3 hover:border-blue-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="font-medium text-sm leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">
          {c.full_name}
        </p>
        <ScorePill score={c.blended_score ?? c.match_score} />
      </div>
      {c.current_title && (
        <p className="text-xs leading-snug mb-1.5" style={{ color: 'var(--muted)' }}>
          {c.current_title}{c.current_company ? ` · ${c.current_company}` : ''}
        </p>
      )}
      {assignment.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {assignment.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: '#F5F3FF', color: '#5B21B6' }}>
              {tag}
            </span>
          ))}
          {assignment.tags.length > 3 && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>+{assignment.tags.length - 3}</span>
          )}
        </div>
      )}
      {assignment.recruiter_notes && (
        <p className="text-xs mt-1.5 italic line-clamp-1" style={{ color: 'var(--muted)' }}>
          "{assignment.recruiter_notes}"
        </p>
      )}
    </button>
  )
}

// ── Main Kanban board ────────────────────────────────────────────────────────

export default function KanbanClient({
  jobId,
  initialAssignments,
}: {
  jobId: string
  initialAssignments: Assignment[]
}) {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [selected, setSelected] = useState<Assignment | null>(null)
  const [search, setSearch] = useState('')
  const [, startTransition] = useTransition()

  const filtered = search
    ? assignments.filter(a =>
        a.candidate.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (a.candidate.current_title ?? '').toLowerCase().includes(search.toLowerCase()) ||
        a.tags.some(t => t.includes(search.toLowerCase()))
      )
    : assignments

  async function handleStageChange(assignmentId: string, stage: Stage) {
    // Optimistic update
    startTransition(() => {
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, pipeline_stage: stage } : a
      ))
      if (selected?.id === assignmentId) {
        setSelected(prev => prev ? { ...prev, pipeline_stage: stage } : null)
      }
    })

    await fetch(`/api/assignments/${assignmentId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
  }

  function handleNotesChange(assignmentId: string, notes: string) {
    startTransition(() => {
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, recruiter_notes: notes } : a
      ))
    })
  }

  function handleTagsChange(assignmentId: string, tags: string[]) {
    startTransition(() => {
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId ? { ...a, tags } : a
      ))
      if (selected?.id === assignmentId) {
        setSelected(prev => prev ? { ...prev, tags } : null)
      }
    })
  }

  const rejected = filtered.filter(a => a.pipeline_stage === 'rejected')

  return (
    <>
      {selected && (
        <CardModal
          assignment={selected}
          onClose={() => setSelected(null)}
          onStageChange={(stage) => handleStageChange(selected.id, stage)}
          onNotesChange={(notes) => handleNotesChange(selected.id, notes)}
          onTagsChange={(tags) => handleTagsChange(selected.id, tags)}
        />
      )}

      {/* Search + stats bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text" placeholder="Search candidates, tags…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 w-64"
        />
        <p className="text-sm ml-auto" style={{ color: 'var(--muted)' }}>
          {assignments.length} candidates · {assignments.filter(a => a.pipeline_stage === 'hired').length} hired
        </p>
      </div>

      {/* Kanban columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map(stage => {
            const cards = filtered.filter(a => a.pipeline_stage === stage.key)
            return (
              <div key={stage.key} className="w-64 flex-shrink-0">
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-2"
                  style={{ background: stage.bg }}>
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: stage.color }}>
                    {stage.label}
                  </span>
                  <span className="text-xs font-bold tabular-nums w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: stage.color, color: '#fff' }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-24">
                  {cards.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed p-4 text-center"
                      style={{ borderColor: '#E5E7EB' }}>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>No candidates</p>
                    </div>
                  ) : cards.map(a => (
                    <KanbanCard key={a.id} assignment={a} onClick={() => setSelected(a)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rejected section */}
      {rejected.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>
            Rejected ({rejected.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rejected.map(a => (
              <KanbanCard key={a.id} assignment={a} onClick={() => setSelected(a)} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
