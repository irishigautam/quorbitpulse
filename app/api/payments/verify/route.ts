import { NextRequest, NextResponse, after } from 'next/server'
import { verifyWebhookSignature, razorpay, PLAN_JOBS_QUOTA } from '@/lib/razorpay'
import { PLAN_LIMITS } from '@/lib/subscription'
import type { PlanTier } from '@/types'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/emails'
import { logAudit } from '@/lib/audit/log'
import { notifyAttempt } from '@/lib/notifications/log'
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

  // P0-016: look up which tier this order was created for (stashed in
  // Razorpay order notes by create-order/route.ts) so growth/scale
  // checkouts activate the right jobs_quota instead of always getting the
  // flat starter quota. Falls back to starter/PLAN_JOBS_QUOTA if the order
  // has no tier note (e.g. older orders created before this existed).
  let tier: PlanTier = 'starter'
  try {
    const order = await razorpay.orders.fetch(razorpay_order_id)
    const noteTier = (order?.notes as Record<string, string> | undefined)?.tier
    if (noteTier === 'starter' || noteTier === 'growth' || noteTier === 'scale') {
      tier = noteTier
    }
  } catch (err) {
    console.error('[verify-payment] order lookup failed, defaulting to starter tier:', err)
  }

  const jobsQuota = tier === 'starter' ? PLAN_JOBS_QUOTA : PLAN_LIMITS[tier].jobs_quota

  // Activate plan
  const serviceClient = createServiceClient()
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const { data: company, error } = await serviceClient
    .from('companies')
    .update({
      plan_active: true,
      plan_expires_at: expiresAt.toISOString(),
      plan_tier: tier,
      jobs_quota: jobsQuota,
      razorpay_subscription_id: razorpay_payment_id,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[verify-payment] DB error:', error)
    return NextResponse.json({ error: 'Failed to activate plan' }, { status: 500 })
  }

  // Post-response side effects, guaranteed to finish via after() (same
  // fire-and-forget reliability fix as jobs/create/route.ts — this was
  // previously .catch(console.error) with no guarantee of completing).
  after(async () => {
    await Promise.allSettled([
      notifyAttempt({
        channel: 'email',
        template: 'welcome',
        companyId: company.id,
        recipient: company.careers_email,
        metadata: { source: 'payments/verify' },
        send: () => sendWelcomeEmail(company),
      }),
      logAudit({
        companyId: company.id,
        actorId: user.id,
        actorRole: 'system',
        action: 'billing.plan_change',
        targetType: 'company',
        targetId: company.id,
        metadata: { razorpay_payment_id, tier, source: 'payments/verify' },
      }),
    ])
  })

  return NextResponse.json({ success: true })
}
