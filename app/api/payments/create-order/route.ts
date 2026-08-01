import { NextRequest, NextResponse } from 'next/server'
import { razorpay, PLAN_CURRENCY, getTierPricePaise } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import type { PlanTier } from '@/types'

const VALID_TIERS: PlanTier[] = ['starter', 'growth', 'scale']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // P0-016: tier is optional and defaults to 'starter' (the original flat
  // plan) so existing callers that don't send a body keep working exactly
  // as before.
  let tier: PlanTier = 'starter'
  try {
    const body = await req.json()
    if (body?.tier) tier = body.tier
  } catch {
    // no body sent — fall back to starter, unchanged from prior behavior
  }

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 })
  }

  const amount = getTierPricePaise(tier)
  if (amount === null) {
    return NextResponse.json(
      { error: 'This plan is not available for checkout yet. Contact us to get set up.' },
      { status: 400 },
    )
  }

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: PLAN_CURRENCY,
      receipt: `jobpulse_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, tier },
    })

    return NextResponse.json({ order, tier })
  } catch (err) {
    console.error('[create-order]', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
