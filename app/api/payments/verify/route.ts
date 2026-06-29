import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, PLAN_JOBS_QUOTA } from '@/lib/razorpay'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/emails'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body

  // Verify signature
  const generated_signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (generated_signature !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Activate plan
  const serviceClient = createServiceClient()
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const { data: company, error } = await serviceClient
    .from('companies')
    .update({
      plan_active: true,
      plan_expires_at: expiresAt.toISOString(),
      jobs_quota: PLAN_JOBS_QUOTA,
      razorpay_subscription_id: razorpay_payment_id,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[verify-payment] DB error:', error)
    return NextResponse.json({ error: 'Failed to activate plan' }, { status: 500 })
  }

  // Send welcome email (non-blocking)
  sendWelcomeEmail(company).catch(console.error)

  return NextResponse.json({ success: true })
}
