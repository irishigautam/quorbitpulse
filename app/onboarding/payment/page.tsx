'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

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

function PaymentContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => setScriptLoaded(true)
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  // The dev-only "skip payment" button and its backing /api/payments/dev-activate
  // route were removed - the route always returned 403 (it was a security fix
  // after realizing a leaked DEV_PAYMENT_BYPASS env var would let any
  // authenticated user activate any plan for free), so the button was already
  // permanently broken. Left as a stale dead route + dead button, it was still
  // attack surface someone could poke at. Use Razorpay test mode + the coupon
  // code flow for testing instead.

  const handlePayment = async () => {
    if (!scriptLoaded) return setError('Payment system loading, please wait.')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/payments/create-order', { method: 'POST' })
      const { order } = await res.json()

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: order.amount,
        currency: order.currency,
        name: 'JobPulse by Quorbit',
        description: '₹3,999/year — 30 job postings',
        handler: async (response) => {
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

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await fetch('/api/payments/coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push('/dashboard?welcome=1')
      } else {
        setCouponError(data.error || 'Invalid coupon code.')
      }
    } catch {
      setCouponError('Something went wrong. Please try again.')
    } finally {
      setCouponLoading(false)
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

        <div className="mt-4 pt-4 border-t text-center">
          {!showCoupon ? (
            <button
              type="button"
              onClick={() => setShowCoupon(true)}
              className="text-xs underline"
              style={{ color: 'var(--muted)' }}
            >
              Have a coupon code?
            </button>
          ) : (
            <div className="text-left">
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--muted)' }}>
                Coupon code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  {couponLoading ? 'Applying…' : 'Apply'}
                </button>
              </div>
              {couponError && (
                <p className="text-xs text-red-600 mt-2">{couponError}</p>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
