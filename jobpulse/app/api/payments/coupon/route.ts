/**
 * POST /api/payments/coupon
 * Validates a 100%-off coupon code and activates the company plan.
 *
 * SECURITY: Codes are stored in COUPON_CODES env var (comma-separated),
 * NOT hardcoded in source. Rotate codes in Vercel without code changes.
 * Also rate-limited: 5 attempts per user per hour to prevent brute-force.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/emails'
import { PLAN_JOBS_QUOTA } from '@/lib/razorpay'
import { rateLimit } from '@/lib/security/rate-limit'

function getValidCoupons(): Set<string> {
  const raw = process.env.COUPON_CODES ?? ''
  return new Set(raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate-limit coupon attempts: 5 per hour per user to prevent brute-force
  const rl = await rateLimit(user.id, { windowMs: 60 * 60_000, max: 5, keyPrefix: 'coupon' })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many coupon attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } },
    )
  }

  const { code } = await req.json()
  const validCoupons = getValidCoupons()

  if (validCoupons.size === 0) {
    // No coupons configured — this endpoint is inactive
    return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
  }

  if (!validCoupons.has((code || '').toUpperCase().trim())) {
    return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const { data: company, error } = await serviceClient
    .from('companies')
    .update({
      plan_active: true,
      plan_expires_at: expiresAt.toISOString(),
      jobs_quota: PLAN_JOBS_QUOTA,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[coupon] DB error:', error)
    return NextResponse.json({ error: 'Failed to activate plan' }, { status: 500 })
  }

  sendWelcomeEmail(company).catch(console.error)
  return NextResponse.json({ success: true })
}
