/**
 * GET /api/billing/plan
 * Returns company's current plan tier, usage, and limits.
 *
 * PATCH /api/billing/plan
 * Body: { plan_tier: 'starter' | 'growth' | 'scale', billing_cycle?: 'monthly' | 'annual' }
 * Updates company plan (called after Razorpay payment succeeds).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getMonthlyUsage, getLimits, getTier } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { company } = await requireCompany()
    const usage = await getMonthlyUsage(company.id)
    const limits = getLimits(company)
    const tier = getTier(company)

    return NextResponse.json({
      tier,
      billing_cycle: (company as any).billing_cycle ?? 'monthly',
      usage,
      limits,
      overage: {
        imports: limits.imports_per_month === -1 ? false : usage.imports >= limits.imports_per_month,
        chats:   limits.chats_per_month   === -1 ? false : usage.chats   >= limits.chats_per_month,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/billing/plan is intentionally disabled for self-service.
 * Plan upgrades MUST go through Razorpay payment verification or the
 * /api/webhooks/razorpay webhook. This prevents billing bypass.
 */
export async function PATCH() {
  return NextResponse.json(
    { error: 'Plan changes must go through the payment flow.' },
    { status: 403 },
  )
}
