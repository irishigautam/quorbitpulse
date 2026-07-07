/**
 * GET /auth/confirm
 *
 * Supabase SSR token-exchange handler. Every Supabase auth email
 * (magic links, email confirmation, password reset) redirects here.
 * This route exchanges the token_hash for a live session, then sends
 * the user on to their destination.
 *
 * Supabase builds the link as:
 *   {SITE_URL}/auth/confirm?token_hash=...&type=email|recovery|signup
 *
 * Required Supabase dashboard setting:
 *   Authentication → URL Configuration → Site URL = https://pulse.thequorbit.com
 */

import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const next       = searchParams.get('next') ?? '/dashboard'

  if (token_hash && type) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll()         { return cookieStore.getAll() },
          setAll(list) {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      // Session established — redirect to destination
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[auth/confirm] verifyOtp error:', error.message)
  }

  // Token missing, wrong type, or expired — send to login with a message
  return NextResponse.redirect(
    new URL('/onboarding/login?error=link_expired', origin),
  )
}
