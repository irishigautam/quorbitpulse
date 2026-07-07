import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { LIMITS, rateLimitResponse } from '@/lib/security/rate-limit'
import { SECURITY_HEADERS } from '@/lib/security/headers'

// Routes that are rate-limited at the edge (before auth resolves)
const AUTH_ROUTES = ['/onboarding/signup', '/api/auth']

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const { key, value } of SECURITY_HEADERS) {
    response.headers.set(key, value)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Rate-limit auth routes by IP ─────────────────────────────────────────
  if (AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const ip = getClientIp(request)
    const rl = await LIMITS.auth(ip)
    if (!rl.allowed) {
      const res = NextResponse.json(
        { error: 'Too many authentication attempts. Please wait before trying again.' },
        { status: 429 },
      )
      res.headers.set('Retry-After', String(rl.retryAfter ?? 60))
      return applySecurityHeaders(res)
    }
  }

  // ── 2. Supabase session refresh ──────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── 3. Route protection ──────────────────────────────────────────────────────
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/security')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding/login'
      url.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(url)
    }
  }

  if (user && pathname === '/onboarding/signup') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── 4. Apply security headers to all responses ───────────────────────────────
  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
