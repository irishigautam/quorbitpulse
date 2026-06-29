import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Company } from '@/types'

/**
 * Returns the current authenticated user's company record.
 * Redirects to /onboarding/signup if unauthenticated.
 * Redirects to /onboarding/payment if plan is not active.
 */
export async function requireCompany(): Promise<{ userId: string; company: Company }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/onboarding/signup')

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !company) redirect('/onboarding/signup')
  if (!company.plan_active) redirect('/onboarding/payment')

  return { userId: user.id, company }
}

/**
 * Returns the company for the current user without plan check.
 * Used on the payment page where plan may not be active yet.
 */
export async function getCompanyForUser(): Promise<Company | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}
