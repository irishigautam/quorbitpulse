/**
 * POST /api/candidate/sync-linkedin
 * Body: { linkedin_url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchLinkedInProfile } from '@/lib/linkedin/proxycurl'
import { mergeLinkedInProfile } from '@/lib/linkedin/merge-profile'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { candidate } = await requireCandidate()
    const supabase = createServiceClient()

    const body = await req.json()
    const linkedin_url: string = (body.linkedin_url ?? '').trim()
    if (!linkedin_url) return NextResponse.json({ error: 'linkedin_url is required' }, { status: 400 })

    const result = await fetchLinkedInProfile(linkedin_url)

    if (!result.ok) {
      if (result.reason === 'private') return NextResponse.json({ error: "This LinkedIn profile is private. We'll use your resume data only.", reason: 'private' }, { status: 422 })
      if (result.reason === 'not_found') return NextResponse.json({ error: 'LinkedIn profile not found. Check the URL and try again.', reason: 'not_found' }, { status: 404 })
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    const merged = await mergeLinkedInProfile(
      {
        current_title: candidate.current_title,
        current_company: candidate.current_company,
        location: candidate.location,
        skills: candidate.skills ?? [],
        domain: candidate.domain ?? [],
        seniority: candidate.seniority,
        years_experience: candidate.years_experience,
        fingerprint_summary: candidate.fingerprint_summary,
      },
      result.profile
    )

    const { error: updateErr } = await supabase
      .from('candidate_profiles')
      .update({
        linkedin_url,
        current_title: merged.current_title ?? candidate.current_title,
        current_company: merged.current_company ?? candidate.current_company,
        location: merged.location ?? candidate.location,
        skills: merged.skills,
        domain: merged.domain,
        seniority: merged.seniority ?? candidate.seniority,
        years_experience: merged.years_experience ?? candidate.years_experience,
        fingerprint_summary: merged.fingerprint_summary,
        projects: merged.projects,
        certifications: merged.certifications,
        publications: merged.publications,
        linkedin_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    const newSkills = merged.skills.filter(s => !(candidate.skills ?? []).includes(s))
    return NextResponse.json({
      success: true,
      summary: {
        skills_before: (candidate.skills ?? []).length,
        skills_after: merged.skills.length,
        new_skills: newSkills,
        projects_found: merged.projects.length,
        certifications_found: merged.certifications.length,
        publications_found: merged.publications.length,
        name: result.profile.full_name,
        headline: result.profile.headline,
      }
    })
  } catch (err: any) {
    console.error('sync-linkedin error:', err)
    return NextResponse.json({ error: err.message ?? 'Sync failed' }, { status: 500 })
  }
}
