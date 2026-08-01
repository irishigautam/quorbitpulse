/**
 * POST /api/events/track
 *
 * Gate 4 — public, best-effort funnel event ingestion for the two signup
 * flows that insert directly from the client (app/onboarding/signup and
 * app/candidate/signup have no dedicated API route to hook into server-side).
 *
 * This endpoint intentionally never fails loudly — the caller fires-and-
 * forgets so a logging hiccup can never block someone completing signup.
 * Always returns 200 with { ok: boolean }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logEvent, type FunnelEventType } from '@/lib/analytics/log-event'

const ALLOWED: FunnelEventType[] = ['company_signup', 'candidate_signup']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const eventType = body?.eventType as FunnelEventType | undefined

    if (!eventType || !ALLOWED.includes(eventType)) {
      // Not an error the caller should ever see or retry on — just no-op.
      return NextResponse.json({ ok: false })
    }

    await logEvent({
      eventType,
      companyId: body?.companyId ?? null,
      entityId: body?.entityId ?? null,
      metadata: body?.metadata ?? {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('events/track error:', err)
    return NextResponse.json({ ok: false })
  }
}
