import { NextResponse } from 'next/server'
import { razorpay, PLAN_AMOUNT_PAISE, PLAN_CURRENCY } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const order = await razorpay.orders.create({
      amount: PLAN_AMOUNT_PAISE,
      currency: PLAN_CURRENCY,
      receipt: `jobpulse_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id },
    })

    return NextResponse.json({ order })
  } catch (err) {
    console.error('[create-order]', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
