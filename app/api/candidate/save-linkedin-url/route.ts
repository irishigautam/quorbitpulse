/**
 * POST /api/candidate/save-linkedin-url
 *
 * Saves the candidate's LinkedIn URL to their profile.
 * Sync/enrichment is stubbed — will be wired to a real provider post-launch.
 * (Proxycurl shut down; replacement provider TBD in Sprint 2)
 *
 * TODO: Replace with real LinkedIn enrichment provider
 * Options evaluated: RapidAPI "Fresh LinkedIn Profile Data", ScrapingDog, Apify
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function normaliseLinkedInUrl(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    if (!u.hostname.includes('linkedin.com')) return null
    if (!u.pathname.startsWith('/in/')) return null
    const slug = u.pathname.replace(/\/in\/([^/]+)\/?.*/, '/in/$1')
    return `https://www.linkedin.com${slug}`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await requireCandidate()
    const supabase = createServiceClient()

    const body = await req.json()
    const raw: string = (body.linkedin_url ?? '').trim()

    if (!raw) {
      return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 })
    }

    const linkedin_url = normaliseLinkedInUrl(raw)
    if (!linkedin_url) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn URL. Use the format linkedin.com/in/yourname' },
        { status: 422 }
      )
    }

    const { error } = await supabase
      .from('candidate_profiles')
      .update({ linkedin_url, updated_at: new Date().toISOString() })
      .eq('id', candidate.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, linkedin_url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Save failed' }, { status: 500 })
  }
}
