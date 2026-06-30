/**
 * POST /api/payments/dev-activate
 *
 * SECURITY: Permanently disabled. This route existed for local dev testing
 * but is too risky — a leaked DEV_PAYMENT_BYPASS env var would allow
 * any authenticated user to activate any plan for free.
 *
 * For testing: use Razorpay test mode keys + the coupon code flow.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json({ error: 'Not available' }, { status: 403 })
}
