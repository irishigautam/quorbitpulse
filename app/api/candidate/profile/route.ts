/**
 * PATCH /api/candidate/profile — P0-010 / P0-011
 *
 * The candidate profile was entirely read-only beyond re-uploading a resume
 * or editing the LinkedIn URL — no way to correct a bad AI parse (wrong
 * seniority, missing skill, wrong years of experience) or edit basic
 * identity fields (name, location, current title/company). Confirmed no
 * such route or UI existed anywhere in the repo while auditing the P0
 * checklist.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCandidate } from '@/lib/candidate-auth'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_SENIORITY = ['intern', 'junior', 'mid', 'senior', 'lead', 'principal']

export async function PATCH(req: NextRequest) {
  const { candidate } = await requireCandidate()
  const body = await req.json()

  const updates: Record<string, unknown> = {}

  if (typeof body.full_name === 'string') {
    const v = body.full_name.trim()
    if (!v) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    updates.full_name = v
  }
  if (typeof body.location === 'string') updates.location = body.location.trim() || null
  if (typeof body.current_title === 'string') updates.current_title = body.current_title.trim() || null
  if (typeof body.current_company === 'string') updates.current_company = body.current_company.trim() || null

  if (Array.isArray(body.skills)) {
    updates.skills = body.skills.map((s: unknown) => String(s).trim()).filter(Boolean)
  }
  if (Array.isArray(body.domain)) {
    updates.domain = body.domain.map((d: unknown) => String(d).trim()).filter(Boolean)
  }
  if (body.seniority !== undefined) {
    if (body.seniority !== null && !VALID_SENIORITY.includes(body.seniority)) {
      return NextResponse.json({ error: `Invalid seniority. Must be one of: ${VALID_SENIORITY.join(', ')}` }, { status: 400 })
    }
    updates.seniority = body.seniority
  }
  if (body.years_experience !== undefined) {
    const n = body.years_experience === null ? null : Number(body.years_experience)
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > 60)) {
      return NextResponse.json({ error: 'years_experience must be between 0 and 60' }, { status: 400 })
    }
    updates.years_experience = n
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: updated, error } = await supabase
    .from('candidate_profiles')
    .update(updates)
    .eq('id', candidate.id)
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true, profile: updated })
}
