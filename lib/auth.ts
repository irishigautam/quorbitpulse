import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Company } from '@/types'

export type MemberRole = 'admin' | 'recruiter' | 'viewer'

export interface CompanyMember {
  userId: string
  companyId: string
  role: MemberRole
  company: Company
}

/**
 * Returns the current authenticated user's company + their role.
 * Resolves company via company_members table (supports multi-user).
 * Redirects to /onboarding/signup if unauthenticated or not a member.
 * Redirects to /onboarding/payment if plan is not active.
 */
export async function requireCompany(): Promise<{ userId: string; companyId: string; company: Company; role: MemberRole }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/onboarding/login')

  // Look up membership — join to company in one query
  const { data: membership } = await supabase
    .from('company_members')
    .select('role, company:companies(*)')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)  // must have accepted invite (owners have accepted_at set at migration)
    .order('created_at', { ascending: true })  // oldest membership = primary company
    .limit(1)
    .single()

  if (!membership || !membership.company) {
    // Fall back: check if user owns a company directly (legacy rows without member entry)
    const { data: ownedCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!ownedCompany) redirect('/onboarding/login')

    // Auto-create member entry for legacy owner
    const svc = createServiceClient()
    await svc.from('company_members').upsert({
      company_id: ownedCompany.id,
      user_id: user.id,
      role: 'admin',
      accepted_at: new Date().toISOString(),
    }, { onConflict: 'company_id,user_id' })

    if (!ownedCompany.plan_active) redirect('/onboarding/payment')
    return { userId: user.id, companyId: ownedCompany.id, company: ownedCompany as Company, role: 'admin' }
  }

  const company = membership.company as unknown as Company
  if (!company.plan_active) redirect('/onboarding/payment')

  return {
    userId: user.id,
    companyId: company.id,
    company,
    role: membership.role as MemberRole,
  }
}

/**
 * Like requireCompany() but also enforces a minimum role.
 * Throws 403 redirect if the user's role is insufficient.
 *
 * Role hierarchy: admin > recruiter > viewer
 */
export async function requireRole(minimumRole: MemberRole) {
  const result = await requireCompany()
  const hierarchy: MemberRole[] = ['viewer', 'recruiter', 'admin']

  if (hierarchy.indexOf(result.role) < hierarchy.indexOf(minimumRole)) {
    redirect('/dashboard?error=insufficient_permissions')
  }

  return result
}

/**
 * Returns the company for the current user without plan check.
 * Used on the payment page where plan may not be active yet.
 */
export async function getCompanyForUser(): Promise<Company | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Try via membership first
  const { data: membership } = await supabase
    .from('company_members')
    .select('company:companies(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (membership?.company) return membership.company as unknown as Company

  // Fallback: direct ownership
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}

/**
 * requireCandidate — returns authenticated candidate profile.
 * Redirects to /candidate/login if unauthenticated.
 */
export async function requireCandidate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/candidate/login')

  const { data: profile } = await supabase
    .from('candidate_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/candidate/signup')

  return { userId: user.id, profile }
}
