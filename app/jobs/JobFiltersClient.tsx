'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import TagInput from '@/components/TagInput'

const JOB_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
]

interface Props {
  initialParams: {
    q?: string
    location?: string
    type?: string
    remote?: string
    skills?: string
    since?: string
  }
}

export default function JobFiltersClient({ initialParams }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [q, setQ] = useState(initialParams.q ?? '')
  const [location, setLocation] = useState(initialParams.location ?? '')
  const [types, setTypes] = useState<string[]>(initialParams.type ? [initialParams.type] : [])
  const [remote, setRemote] = useState(initialParams.remote === 'true')
  const [skills, setSkills] = useState<string[]>(
    initialParams.skills ? initialParams.skills.split(',').filter(Boolean) : []
  )
  const [since, setSince] = useState(initialParams.since ?? '')

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (location) params.set('location', location)
    if (types.length > 0) params.set('type', types[0])
    if (remote) params.set('remote', 'true')
    if (skills.length > 0) params.set('skills', skills.join(','))
    if (since) params.set('since', since)

    startTransition(() => {
      router.push(`/jobs?${params.toString()}`)
    })
  }

  const clearFilters = () => {
    setQ(''); setLocation(''); setTypes([]); setRemote(false); setSkills([]); setSince('')
    startTransition(() => router.push('/jobs'))
  }

  const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filters</span>
        <button onClick={clearFilters} className="text-xs hover:opacity-75" style={{ color: 'var(--accent)' }}>
          Clear all
        </button>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Search</label>
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Job title, skills…"
          className={inputClass}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="City or region"
          className={inputClass}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-2">Job type</label>
        <div className="space-y-1.5">
          {JOB_TYPES.map(t => (
            <label key={t.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={types.includes(t.value)}
                onChange={e => {
                  setTypes(e.target.checked ? [t.value] : [])
                }}
                className="rounded"
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={remote}
            onChange={e => setRemote(e.target.checked)}
            className="rounded"
          />
          Remote only
        </label>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Skills</label>
        <TagInput
          value={skills}
          onChange={setSkills}
          placeholder="Add skill…"
        />
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Posted within</label>
        <select value={since} onChange={e => setSince(e.target.value)} className={inputClass}>
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      <button
        onClick={applyFilters}
        disabled={isPending}
        className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors"
        style={{ background: isPending ? 'var(--muted)' : 'var(--accent)' }}
      >
        {isPending ? 'Filtering…' : 'Apply filters'}
      </button>
    </div>
  )
}
