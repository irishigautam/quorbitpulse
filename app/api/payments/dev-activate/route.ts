/**
 * POST /api/payments/dev-activate
 *
 * Dev-only bypass: activates the authenticated company's plan without
 * going through Razorpay. Only works when NODE_ENV !== 'production'
 * OR when DEV_PAYMENT_BYPASS=true env var is set.
 */

import { NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const bypassAllowed =
    process.env.NODE_ENV !== 'production' ||
    process.env.DEV_PAYMENT_BYPASS === 'true'

  if (!bypassAllowed) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { companyId } = await requireCompany()
    const supabase = createServiceClient()

    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)

    const { error } = await supabase
      .from('companies')
      .update({
        plan_active: true,
        plan_tier: 'growth',
        billing_cycle: 'annual',
        plan_expires_at: expiry.toISOString(),
      })
      .eq('id', companyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Plan activated (dev bypass)' })
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
