/**
 * GET  /api/job-sources  — list all career page sources
 * POST /api/job-sources  — add a new career page source
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { detectAtsFromUrl, detectAtsFromHtml } from '@/lib/job-supply/career-scraper'

export async function GET() {
  const { error } = await requireCompany()
  if (error) return error

  const supabase = createServiceClient()
  const { data, error: dbErr } = await supabase
    .from('career_page_sources')
    .select('*')
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ sources: data })
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireCompany()
  if (authErr) return authErr

  const body = await req.json()
  const { company_name, career_url } = body

  if (!company_name?.trim() || !career_url?.trim()) {
    return NextResponse.json({ error: 'company_name and career_url required' }, { status: 400 })
  }

  // Validate URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(career_url.trim())
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Auto-detect ATS
  let atsType: string | null = null
  let atsSlug: string | null = null

  const fromUrl = detectAtsFromUrl(parsedUrl.toString())
  if (fromUrl.ats_type) {
    atsType = fromUrl.ats_type
    atsSlug = fromUrl.ats_slug
  } else {
    // Try HTML detection (async, with timeout)
    try {
      const fromHtml = await Promise.race([
        detectAtsFromHtml(parsedUrl.toString()),
        new Promise<{ ats_type: null; ats_slug: null }>(resolve =>
          setTimeout(() => resolve({ ats_type: null, ats_slug: null }), 8_000)
        ),
      ])
      atsType = fromHtml.ats_type
      atsSlug = fromHtml.ats_slug
    } catch {
      atsType = 'html'
    }
  }

  const supabase = createServiceClient()
  const { data, error: dbErr } = await supabase
    .from('career_page_sources')
    .insert({
      company_name: company_name.trim(),
      career_url: parsedUrl.toString(),
      ats_type: atsType,
      ats_slug: atsSlug,
      active: true,
    })
    .select()
    .single()

  if (dbErr) {
    if (dbErr.code === '23505') {
      return NextResponse.json({ error: 'This URL is already tracked' }, { status: 409 })
    }
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ source: data, detected_ats: atsType })
}
