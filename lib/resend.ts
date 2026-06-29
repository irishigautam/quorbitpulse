import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@jobpulse.io'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'
