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

export async function PATCH(req: NextRequest) {
  try {
    const { company } = await requireCompany()
    const supabase = createServiceClient()

    const { plan_tier, billing_cycle } = await req.json()
    const validTiers = ['starter', 'growth', 'scale']
    if (!validTiers.includes(plan_tier)) {
      return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })
    }

    const { error } = await supabase
      .from('companies')
      .update({
        plan_tier,
        billing_cycle: billing_cycle ?? 'monthly',
        updated_at: new Date().toISOString(),
      })
      .eq('id', company.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ plan_tier, billing_cycle: billing_cycle ?? 'monthly' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
