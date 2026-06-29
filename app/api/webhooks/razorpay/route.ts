import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, PLAN_JOBS_QUOTA } from '@/lib/razorpay'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const serviceClient = createServiceClient()

  if (event.event === 'payment.captured') {
    const notes = event.payload?.payment?.entity?.notes ?? {}
    const userId = notes.user_id

    if (userId) {
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)

      await serviceClient
        .from('companies')
        .update({
          plan_active: true,
          plan_expires_at: expiresAt.toISOString(),
          jobs_quota: PLAN_JOBS_QUOTA,
        })
        .eq('user_id', userId)
    }
  }

  return NextResponse.json({ received: true })
}
