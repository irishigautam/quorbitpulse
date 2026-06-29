'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/RichTextEditor'
import TagInput from '@/components/TagInput'
import type { JobType, PostJobFormValues } from '@/types'
import { DOMAINS } from '@/app/api/jobs/suggest-domain/route'
import type { Domain, SeniorityLevel } from '@/app/api/jobs/suggest-domain/route'

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
]

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED']

const LEVEL_LABELS: Record<SeniorityLevel, string> = {
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior IC',
  manager: 'Manager',
  director: 'Director / VP',
  executive: 'Executive / C-suite',
}

const LEVEL_COLORS: Record<SeniorityLevel, { bg: string; color: string }> = {
  entry:     { bg: '#E1F5EE', color: '#085041' },
  mid:       { bg: '#E6F1FB', color: '#0C447C' },
  senior:    { bg: '#EEEDFE', color: '#3C3489' },
  manager:   { bg: '#FAEEDA', color: '#633806' },
  director:  { bg: '#FAECE7', color: '#712B13' },
  executive: { bg: '#FCEBEB', color: '#791F1F' },
}

interface SkillLayers {
  domain: string[]
  seniority: string[]
}

export default function PostJobPage() {
  const router = useRouter()
  const [form, setForm] = useState<PostJobFormValues>({
    title: '',
    job_type: 'full_time',
    location: '',
    remote: false,
    skills: [],
    domain: [],
    min_experience: 0,
    salary_min: '',
    salary_max: '',
    salary_currency: 'INR',
    description: '',
    apply_method: 'url',
    apply_url: '',
    apply_email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null)

  // Detection state
  const [detecting, setDetecting] = useState(false)
  const [autoDetected, setAutoDetected] = useState(false)
  const [detectedLevel, setDetectedLevel] = useState<SeniorityLevel | null>(null)
  const [skillLayers, setSkillLayers] = useState<SkillLayers>({ domain: [], seniority: [] })
  const detectTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('companies')
        .select('jobs_used, jobs_quota')
        .eq('user_id', user.id)
        .single()
      if (data) setQuota({ used: data.jobs_used, total: data.jobs_quota })
    })
  }, [])

  const runDetection = useCallback(async (
    title: string,
    description: string,
    domain: string,
    minExperience: number,
  ) => {
    const combined = (title + ' ' + description.replace(/<[^>]*>/g, '')).trim()
    if (combined.length < 10 && !domain) return

    setDetecting(true)
    try {
      const res = await fetch('/api/jobs/suggest-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, domain, minExperience }),
      })
      const data = await res.json()

      if (data.domains?.length > 0 && !domain) {
        setForm(f => ({ ...f, domain: data.domains }))
        setAutoDetected(true)
      }
      if (data.level) setDetectedLevel(data.level)
      if (data.skillLayers) setSkillLayers(data.skillLayers)
    } catch {
      // Silently fail
    } finally {
      setDetecting(false)
    }
  }, [])

  // Re-detect when title, description, domain or min_experience changes
  useEffect(() => {
    if (detectTimer.current) clearTimeout(detectTimer.current)
    detectTimer.current = setTimeout(() => {
      runDetection(form.title, form.description, form.domain[0] ?? '', form.min_experience)
    }, 700)
    return () => { if (detectTimer.current) clearTimeout(detectTimer.current) }
  }, [form.title, form.description, form.domain, form.min_experience, runDetection])

  const handleDomainChange = (domain: string) => {
    setForm(f => ({ ...f, domain: domain ? [domain] : [] }))
    setAutoDetected(false)
  }

  const addChip = (skill: string) => {
    if (!form.skills.includes(skill)) {
      setForm(f => ({ ...f, skills: [...f.skills, skill] }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) return setError('Job title is required.')
    if (!form.location.trim()) return setError('Location is required.')
    const descText = form.description.replace(/<[^>]*>/g, '').trim()
    if (descText.length < 100) return setError('Job description must be at least 100 characters.')
    if (form.apply_method === 'url' && !form.apply_url.trim()) return setError('Apply URL is required.')
    if (form.apply_method === 'email' && !form.apply_email.trim()) return setError('Apply email is required.')
    if (quota && quota.used >= quota.total) {
      return setError(`You've used all ${quota.total} job postings.`)
    }

    setLoading(true)
    try {
      const res = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to post job')
      }
      router.push('/dashboard/jobs?posted=1')
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
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + 60)

  const currentDomain = form.domain[0] as Domain | undefined
  const domainChips = skillLayers.domain.filter(s => !form.skills.includes(s))
  const seniorityChips = skillLayers.seniority.filter(s => !form.skills.includes(s))
  const hasChips = domainChips.length > 0 || seniorityChips.length > 0

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Post a Job</h1>
          {quota && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              {quota.total - quota.used} of {quota.total} postings remaining
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border p-6">

        {/* Job title */}
        {field('Job title *',
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Senior Software Engineer"
            className={inputClass}
          />
        )}

        {/* Job type */}
        {field('Job type *',
          <select
            value={form.job_type}
            onChange={e => setForm(f => ({ ...f, job_type: e.target.value as JobType }))}
            className={inputClass}
          >
            {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}

        {/* Location */}
        {field('Location *',
          <div className="space-y-2">
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Mumbai, India"
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

        {/* Description */}
        {field('Job description * (min 100 chars)',
          <RichTextEditor
            value={form.description}
            onChange={description => setForm(f => ({ ...f, description }))}
            placeholder="Describe the role, responsibilities, and requirements…"
          />
        )}

        {/* Min experience + Role domain — side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Min. experience
              {detectedLevel && (
                <span
                  className="ml-2 text-xs px-2 py-0.5 rounded-full font-normal"
                  style={LEVEL_COLORS[detectedLevel]}
                >
                  {LEVEL_LABELS[detectedLevel]}
                </span>
              )}
            </label>
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
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Used to infer seniority for skill suggestions.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium">Role domain</label>
              {detecting && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                  Detecting…
                </span>
              )}
              {autoDetected && !detecting && currentDomain && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#15803D' }}>
                  ✦ Auto-detected
                </span>
              )}
            </div>
            <select
              value={currentDomain ?? ''}
              onChange={e => handleDomainChange(e.target.value)}
              className={inputClass}
              style={currentDomain ? { borderColor: 'var(--accent)' } : {}}
            >
              <option value="">— Select or auto-detect</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Improves matching beyond exact skill keywords.
            </p>
          </div>
        </div>

        {/* Skills + layered chip suggestions */}
        <div>
          <label className="block text-sm font-medium mb-1">Skills</label>
          <TagInput
            value={form.skills}
            onChange={skills => setForm(f => ({ ...f, skills }))}
            placeholder={currentDomain ? `Type a skill or pick from suggestions below…` : 'e.g. React, Python — press Enter'}
          />

          {hasChips && (
            <div className="mt-3 space-y-2.5">
              {domainChips.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                    {currentDomain} skills for {detectedLevel ? LEVEL_LABELS[detectedLevel] : 'this level'}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {domainChips.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addChip(skill)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-blue-50"
                        style={{ borderColor: 'var(--accent-light)', color: 'var(--accent)', background: 'var(--accent-light)' }}
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {seniorityChips.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                    {detectedLevel ? LEVEL_LABELS[detectedLevel] : 'Seniority'} skills (leadership & cross-role):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {seniorityChips.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addChip(skill)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-colors hover:bg-purple-50"
                        style={{ borderColor: '#AFA9EC', color: '#3C3489', background: '#EEEDFE' }}
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Press Enter or comma after each custom skill.
          </p>
        </div>

        {/* Salary */}
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

        {/* Apply */}
        <div>
          <label className="block text-sm font-medium mb-2">How to apply *</label>
          <div className="flex gap-4 mb-2">
            {(['url', 'email'] as const).map(method => (
              <label key={method} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={method}
                  checked={form.apply_method === method}
                  onChange={() => setForm(f => ({ ...f, apply_method: method }))}
                />
                {method === 'url' ? 'Link (URL)' : 'Email'}
              </label>
            ))}
          </div>
          {form.apply_method === 'url' ? (
            <input
              type="url"
              value={form.apply_url}
              onChange={e => setForm(f => ({ ...f, apply_url: e.target.value }))}
              placeholder="https://acme.com/jobs/apply"
              className={inputClass}
            />
          ) : (
            <input
              type="email"
              value={form.apply_email}
              onChange={e => setForm(f => ({ ...f, apply_email: e.target.value }))}
              placeholder="careers@acme.com"
              className={inputClass}
            />
          )}
        </div>

        {/* Expiry */}
        {field('Listing expires',
          <input
            type="text"
            readOnly
            value={expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            className={`${inputClass} bg-gray-50 cursor-not-allowed`}
          />,
          'Automatically set to 60 days from today.'
        )}

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
            {loading ? 'Posting…' : 'Publish job →'}
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
