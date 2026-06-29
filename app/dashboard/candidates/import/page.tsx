'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ImportResult } from '@/types'

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

const TEMPLATE_CSV = `full_name,email,linkedin_url,current_title,current_company,location
Priya Sharma,priya@example.com,https://linkedin.com/in/priyasharma,Senior Frontend Engineer,Razorpay,Bangalore
Arjun Mehta,arjun@example.com,https://linkedin.com/in/arjunmehta,Product Manager,Swiggy,Mumbai
Neha Kulkarni,,https://linkedin.com/in/nehakulkarni,Data Scientist,Flipkart,Hyderabad`

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f: File) {
    if (!f.name.match(/\.(csv|txt)$/i)) {
      setError('Only .csv files are supported')
      return
    }
    setFile(f)
    setError(null)
    setState('idle')
    setResult(null)
  }

  async function handleUpload() {
    if (!file) return
    setState('uploading')
    setError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/candidates/import', { method: 'POST', body: fd })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Import failed')
        setState('error')
        return
      }

      setResult(json as ImportResult)
      setState('done')
    } catch {
      setError('Network error — please try again')
      setState('error')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quorbit-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/candidates" className="text-sm hover:underline" style={{ color: 'var(--muted)' }}>
          ← Candidates
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Import Candidates
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Upload a CSV exported from LinkedIn, Apollo, Naukri, or any sourcing tool.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="text-xs px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          style={{ color: 'var(--muted)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download template
        </button>
      </div>

      {state === 'done' && result ? (
        /* ── Success state ── */
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-5 border-b" style={{ background: '#F0FDF4' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#15803D' }}>Import complete</p>
                <p className="text-sm" style={{ color: '#16A34A' }}>{result.inserted} candidate{result.inserted !== 1 ? 's' : ''} added to your pool</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Imported', value: result.inserted, color: '#16A34A' },
                { label: 'Duplicates skipped', value: result.skipped_dups, color: '#D97706' },
                { label: 'Failed rows', value: result.failed, color: '#DC2626' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-4 rounded-xl border">
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard/candidates')}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'var(--accent)' }}
              >
                View candidate pool →
              </button>
              <button
                onClick={() => { setFile(null); setResult(null); setState('idle') }}
                className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
              >
                Import more
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Upload state ── */
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center" style={{ background: '#DCFCE7' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB · Click to change
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-gray-100 mx-auto flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                </div>
                <p className="font-medium text-sm">Drop your CSV here, or click to browse</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Up to 500 candidates · Max 5MB</p>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          {/* Column guide */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>
              Accepted CSV columns
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { col: 'full_name', req: true },
                { col: 'email', req: false },
                { col: 'linkedin_url', req: false },
                { col: 'current_title', req: false },
                { col: 'current_company', req: false },
                { col: 'location', req: false },
                { col: 'phone', req: false },
                { col: 'notes', req: false },
              ].map(({ col, req }) => (
                <div key={col} className="flex items-center gap-2">
                  <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#F3F4F6', fontFamily: 'monospace' }}>
                    {col}
                  </code>
                  {req && <span className="text-xs font-medium" style={{ color: '#DC2626' }}>required</span>}
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
              Column names are flexible — we also recognise <code className="bg-gray-100 px-1 rounded">name</code>, <code className="bg-gray-100 px-1 rounded">title</code>, <code className="bg-gray-100 px-1 rounded">company</code>, <code className="bg-gray-100 px-1 rounded">linkedin</code> and more.
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || state === 'uploading'}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {state === 'uploading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Importing…
              </span>
            ) : 'Import candidates'}
          </button>
        </div>
      )}

      {/* Future sources */}
      <div className="mt-8 bg-white rounded-2xl border p-5">
        <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>
          More import sources — coming soon
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'LinkedIn', icon: '🔗', note: 'Chrome extension' },
            { name: 'Apollo.io', icon: '🚀', note: 'API integration' },
            { name: 'Naukri', icon: '📋', note: 'Chrome extension' },
          ].map(({ name, icon, note }) => (
            <div key={name} className="border border-dashed rounded-xl p-4 text-center opacity-50">
              <div className="text-xl mb-1">{icon}</div>
              <p className="text-xs font-medium">{name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
