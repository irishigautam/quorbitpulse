import { Resend } from 'resend'

// Use a placeholder during build if env var is not set
export const resend = new Resend(process.env.RESEND_API_KEY ?? 'RESEND_API_KEY_NOT_SET')

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@thequorbit.com'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.thequorbit.com'

// ID-03 (launch checklist) — no transactional email set a reply-to address,
// so a candidate/employer replying to an invite or notification had nowhere
// to land. Defaults to the founder's inbox; override with REPLY_TO_EMAIL in
// Vercel once a dedicated support inbox exists.
export const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL ?? 'rishi@thequorbit.com'
