'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

function isValidUrl(url: string) {
  try { new URL(url.startsWith('http') ? url : `https://${url}`); return true }
  catch { return false }
}

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    website: '',
    careers_email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!form.company_name.trim()) return setError('Company name is required.')
    if (!isValidUrl(form.website)) return setError('Enter a valid website URL.')
    if (!form.careers_email.includes('@')) return setError('Enter a valid email address.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')

    setLoading(true)
    const supabase = createClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.careers_email,
      password: form.password,
    })

    if (authError) {
      setLoading(false)
      return setError(authError.message)
    }

    if (!authData.user) {
      setLoading(false)
      return setError('Failed to create account. Please try again.')
    }

    // Insert company record
    const website = form.website.startsWith('http') ? form.website : `https://${form.website}`
    const { error: companyError } = await supabase.from('companies').insert({
      user_id: authData.user.id,
      name: form.company_name.trim(),
      website,
      careers_email: form.careers_email,
    })

    if (companyError) {
      setLoading(false)
      return setError(companyError.message)
    }

    router.push('/onboarding/payment')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <a href="/" className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
          JobPulse
        </a>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>by Quorbit</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Create your company account
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          Start posting jobs in minutes.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company name</label>
            <input
              type="text"
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="Acme Inc."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company website</label>
            <input
              type="text"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="acme.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Careers email</label>
            <input
              type="email"
              value={form.careers_email}
              onChange={e => setForm(f => ({ ...f, careers_email: e.target.value }))}
              placeholder="careers@acme.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              This will also be your login email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="8+ characters"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: loading ? 'var(--muted)' : 'var(--accent)' }}
          >
            {loading ? 'Creating account…' : 'Continue to payment →'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          Already have an account?{' '}
          <Link href="/onboarding/login" className="underline" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
