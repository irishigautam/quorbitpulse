import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/emails'
import { PLAN_JOBS_QUOTA } from '@/lib/razorpay'

// 100% coupon codes — add more as needed
const VALID_COUPONS = ['DEVACCESS', 'QUORBIT100', 'FREEYEAR']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await req.json()
  if (!VALID_COUPONS.includes((code || '').toUpperCase().trim())) {
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
