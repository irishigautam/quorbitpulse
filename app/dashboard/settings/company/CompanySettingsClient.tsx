'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CompanyFields {
  name: string
  website: string
  careers_email: string | null
  logo_url: string | null
  description: string | null
}

export default function CompanySettingsClient({ company }: { company: CompanyFields }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: company.name ?? '',
    website: company.website ?? '',
    careers_email: company.careers_email ?? '',
    logo_url: company.logo_url ?? '',
    description: company.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)

    const res = await fetch('/api/company/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to save')
    } else {
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem 0.8rem', border: '1px solid var(--border, #E5E7EB)',
    borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' as const,
  }
  const labelStyle = { display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px', fontWeight: 600 }

  return (
    <div className="bg-white rounded-2xl border p-6 max-w-lg" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Company name</label>
        <input
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Website</label>
        <input
          value={form.website}
          onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
          placeholder="acme.com"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Careers email</label>
        <input
          type="email"
          value={form.careers_email}
          onChange={e => setForm(f => ({ ...f, careers_email: e.target.value }))}
          placeholder="careers@acme.com"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Logo URL (optional)</label>
        <input
          value={form.logo_url}
          onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
          placeholder="https://acme.com/logo.png"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>About the company (optional)</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: '0.85rem' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          background: saved ? '#16A34A' : 'var(--accent, #4F46E5)',
          color: '#fff', border: 'none', borderRadius: '8px', padding: '0.75rem',
          fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
      </button>
    </div>
  )
}
