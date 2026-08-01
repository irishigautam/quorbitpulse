'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/components/RichTextEditor'
import TagInput from '@/components/TagInput'
import type { Job, JobType } from '@/types'
import { DOMAINS } from '@/app/api/jobs/suggest-domain/route'
import type { Domain } from '@/app/api/jobs/suggest-domain/route'

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
]

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED']

export default function EditJobClient({ job }: { job: Job }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: job.title,
    job_type: job.job_type,
    location: job.location,
    remote: job.remote,
    skills: job.skills ?? [],
    domain: job.domain ?? [],
    min_experience: job.min_experience ?? 0,
    salary_min: job.salary_min?.toString() ?? '',
    salary_max: job.salary_max?.toString() ?? '',
    salary_currency: job.salary_currency ?? 'INR',
    description: job.description,
    apply_url: job.apply_url ?? '',
    apply_email: job.apply_email ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) return setError('Job title is required.')
    if (!form.location.trim()) return setError('Location is required.')
    const descText = form.description.replace(/<[^>]*>/g, '').trim()
    if (descText.length < 100) return setError('Job description must be at least 100 characters.')

    setLoading(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update job')
      }
      router.push('/dashboard/jobs?edited=1')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, content: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {content}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  )

  const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const currentDomain = form.domain[0] as Domain | undefined

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Edit Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border p-6">

        {field('Job title *',
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className={inputClass}
          />
        )}

        {field('Job type *',
          <select
            value={form.job_type}
            onChange={e => setForm(f => ({ ...f, job_type: e.target.value as JobType }))}
            className={inputClass}
          >
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}

        {field('Location *',
          <div className="space-y-2">
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.remote}
                onChange={e => setForm(f => ({ ...f, remote: e.target.checked }))}
                className="rounded"
              />
              Remote OK
            </label>
          </div>
        )}

        {field('Job description * (min 100 chars)',
          <RichTextEditor
            value={form.description}
            onChange={description => setForm(f => ({ ...f, description }))}
            placeholder="Describe the role, responsibilities, and requirements…"
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Min. experience</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={30}
                value={form.min_experience}
                onChange={e => setForm(f => ({ ...f, min_experience: parseInt(e.target.value) || 0 }))}
                className={inputClass}
                style={{ width: 80 }}
              />
              <span className="text-sm" style={{ color: 'var(--muted)' }}>years</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role domain</label>
            <select
              value={currentDomain ?? ''}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value ? [e.target.value] : [] }))}
              className={inputClass}
            >
              <option value="">— None</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {field('Skills',
          <TagInput
            value={form.skills}
            onChange={skills => setForm(f => ({ ...f, skills }))}
            placeholder="e.g. React, Python — press Enter"
          />
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Salary range (optional)</label>
          <div className="flex gap-2">
            <select
              value={form.salary_currency}
              onChange={e => setForm(f => ({ ...f, salary_currency: e.target.value }))}
              className="border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="number"
              value={form.salary_min}
              onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))}
              placeholder="Min"
              className={`${inputClass} flex-1`}
              min={0}
            />
            <input
              type="number"
              value={form.salary_max}
              onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))}
              placeholder="Max"
              className={`${inputClass} flex-1`}
              min={0}
            />
          </div>
        </div>

        <div>
          <div className="rounded-lg px-3 py-2 mb-3 text-sm" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
            Candidates always apply directly on Pulse. The fields below are optional extra channels only.
          </div>
          <label className="block text-sm font-medium mb-1">Also accepts applications via a link (optional)</label>
          <input
            type="url"
            value={form.apply_url}
            onChange={e => setForm(f => ({ ...f, apply_url: e.target.value }))}
            placeholder="https://acme.com/jobs/apply"
            className={inputClass}
          />
          <label className="block text-sm font-medium mb-1 mt-3">Also accepts applications via email (optional)</label>
          <input
            type="email"
            value={form.apply_email}
            onChange={e => setForm(f => ({ ...f, apply_email: e.target.value }))}
            placeholder="careers@acme.com"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg font-semibold text-white text-sm transition-colors"
            style={{ background: loading ? 'var(--muted)' : 'var(--accent)' }}
          >
            {loading ? 'Saving…' : 'Save changes →'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard/jobs')}
            className="px-6 py-2.5 rounded-lg text-sm border hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
