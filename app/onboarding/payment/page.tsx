'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open(): void }
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
}

export default function PaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDev = searchParams.get('dev') === '1'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => setScriptLoaded(true)
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  const handleDevActivate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/dev-activate', { method: 'POST' })
      if (res.ok) {
        router.push('/dashboard?welcome=1')
      } else {
        const j = await res.json()
        setError(j.error ?? 'Dev activate failed')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!scriptLoaded) return setError('Payment system loading, please wait.')
    setLoading(true)
    setError('')

    try {
      // Create Razorpay order
      const res = await fetch('/api/payments/create-order', { method: 'POST' })
      const { order } = await res.json()

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: order.amount,
        currency: order.currency,
        name: 'JobPulse by Quorbit',
        description: '₹3,999/year — 30 job postings',
        handler: async (response) => {
          // Verify payment on server
          const verify = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, order_id: order.id }),
          })
          if (verify.ok) {
            router.push('/dashboard?welcome=1')
          } else {
            setError('Payment verification failed. Please contact support.')
          }
        },
        theme: { color: '#2563EB' },
      }

      const rp = new window.Razorpay(options)
      rp.open()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
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
          Activate your plan
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          One payment. Post jobs for a full year.
        </p>

        {/* Plan summary */}
        <div className="rounded-xl border-2 p-5 mb-6" style={{ borderColor: 'var(--accent)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              JobPulse Annual Plan
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: 'var(--accent)' }}>
              Best value
            </span>
          </div>
          <div className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            ₹3,999
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--muted)' }}>/year</span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>~$49 USD</p>

          <ul className="space-y-2 text-sm">
            {[
              '30 active job postings',
              'Auto-indexed on Google Jobs',
              'Appears in AI job search (Claude, ChatGPT)',
              'Public REST API + MCP server',
              'RSS feed syndication',
              'Simple dashboard — no ATS required',
            ].map(item => (
              <li key={item} className="flex items-center gap-2">
                <span style={{ color: 'var(--accent)' }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={handlePayment}
          disabled={loading || !scriptLoaded}
          className="w-full py-3 rounded-lg font-semibold text-white transition-colors"
          style={{ background: loading ? 'var(--muted)' : 'var(--accent)', fontFamily: 'var(--font-display)' }}
        >
          {loading ? 'Processing…' : 'Pay ₹3,999 and activate →'}
        </button>

        <p className="text-center text-xs mt-3" style={{ color: 'var(--muted)' }}>
          Secure payment via Razorpay. Instant activation.
        </p>

        {isDev && (
          <div className="mt-6 pt-5 border-t">
            <p className="text-xs text-center mb-3 font-mono" style={{ color: 'var(--muted)' }}>
              ⚙️ Dev mode — skip payment
            </p>
            <button
              onClick={handleDevActivate}
              disabled={loading}
              className="w-full py-2 rounded-lg font-medium text-sm border-2 transition-colors"
              style={{ borderColor: '#059669', color: '#059669' }}
            >
              {loading ? 'Activating…' : 'Activate without payment (dev only)'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
