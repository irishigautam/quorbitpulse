import Razorpay from 'razorpay'
import crypto from 'crypto'

// Use placeholders during build if env vars are not set
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? 'RAZORPAY_KEY_ID_NOT_SET',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? 'RAZORPAY_KEY_SECRET_NOT_SET',
})

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET ?? '')
    .update(body)
    .digest('hex')
  return expectedSignature === signature
}

export const PLAN_AMOUNT_PAISE = 399900 // Rs.3,999 in paise
export const PLAN_CURRENCY = 'INR'
export const PLAN_JOBS_QUOTA = 30
