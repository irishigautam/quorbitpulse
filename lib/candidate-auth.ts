import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { CandidateProfile } from '@/types'

/**
 * Returns the current authenticated candidate's profile.
 * Redirects to /candidate/login if unauthenticated or no profile exists.
 */
export async function requireCandidate(): Promise<{ userId: string; candidate: CandidateProfile }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/candidate/login')

  // Defense-in-depth: block dashboard/API access for an unconfirmed email,
  // mirroring requireCompany()'s check in lib/auth.ts. email_confirmed_at is
  // set automatically at signup if confirmations are disabled project-wide,
  // so this is a no-op in that case.
  if (!user.email_confirmed_at) redirect('/candidate/verify-pending')

  const { data: candidate, error } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !candidate) redirect('/candidate/login')

  return { userId: user.id, candidate: candidate as CandidateProfile }
}

/**
 * Returns the candidate profile without redirecting — returns null if not found.
 */
export async function getCandidateForUser(): Promise<CandidateProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data as CandidateProfile | null
}
