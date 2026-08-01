import Razorpay from 'razorpay'
import crypto from 'crypto'

// Use || so empty string also falls back to placeholder
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'RAZORPAY_KEY_ID_NOT_SET',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'RAZORPAY_KEY_SECRET_NOT_SET',
})

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret_not_set')
    .update(body)
    .digest('hex')
  return expectedSignature === signature
}

export const PLAN_AMOUNT_PAISE = 399900 // Rs.3,999 in paise — the one live, wired-up plan
export const PLAN_CURRENCY = 'INR'
export const PLAN_JOBS_QUOTA = 30

/**
 * P0-016 — 3-tier billing scaffold.
 *
 * lib/subscription.ts already defines starter/growth/scale usage LIMITS, but
 * no checkout flow ever let a company actually purchase growth or scale —
 * only the flat PLAN_AMOUNT_PAISE plan above is live. Setting real prices
 * for growth/scale is a pricing decision, not an engineering one, so this
 * intentionally does NOT hardcode amounts. Each tier's price is read from an
 * env var that is NOT set by default; until Rishi configures it in Vercel,
 * /api/payments/create-order returns "not available yet" for that tier
 * instead of silently charging some placeholder amount.
 */
import type { PlanTier } from '@/types'

export function getTierPricePaise(tier: PlanTier): number | null {
  if (tier === 'starter') {
    const v = process.env.RAZORPAY_PRICE_STARTER_PAISE
    return v ? parseInt(v, 10) : PLAN_AMOUNT_PAISE // starter == the existing live flat plan
  }
  if (tier === 'growth') {
    const v = process.env.RAZORPAY_PRICE_GROWTH_PAISE
    return v ? parseInt(v, 10) : null
  }
  if (tier === 'scale') {
    const v = process.env.RAZORPAY_PRICE_SCALE_PAISE
    return v ? parseInt(v, 10) : null
  }
  return null
}
