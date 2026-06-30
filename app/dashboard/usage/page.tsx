/**
 * mo6 — Usage analytics dashboard (company-facing).
 * Shows: import count, chat response rate, pipeline conversion, avg match score.
 */

import { requireCompany } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getMonthlyUsage, getLimits, getTier } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

export default async function UsageDashboardPage() {
  const { company } = await requireCompany()
  const supabase = createServiceClient()

  const [usage, limits, tier] = [
    await getMonthlyUsage(company.id),
    getLimits(company),
    getTier(company),
  ]

  // Aggregate stats
  const { count: totalCandidates } = await supabase
    .from('imported_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)

  const { count: scoredCandidates } = await supabase
    .from('imported_candidates')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .not('match_score', 'is', null)

  let avgData: { avg_score: number } | null = null
  try {
    const { data } = await supabase.rpc('get_avg_match_score', { p_company_id: company.id }).single()
    avgData = data
  } catch {
    avgData = null
  }

  const { count: chatsSent } = await supabase
    .from('candidate_job_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .not('chat_sent_at', 'is', null)

  const { count: chatsCompleted } = await supabase
    .from('candidate_job_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .not('chat_completed_at', 'is', null)

  const { count: hiredCount } = await supabase
    .from('candidate_job_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .eq('pipeline_stage', 'hired')

  const chatResponseRate = chatsSent ? Math.round(((chatsCompleted ?? 0) / chatsSent) * 100) : 0
  const pipelineConversion = (totalCandidates ?? 0) > 0
    ? Math.round(((hiredCount ?? 0) / (totalCandidates ?? 1)) * 100)
    : 0

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1)

  function Meter({ label, current, limit, color }: { label: string; current: number; limit: number; color: string }) {
    const pct = limit === -1 ? 0 : Math.min(100, Math.round((current / limit) * 100))
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color: 'var(--muted)' }}>
            {current} / {limit === -1 ? '∞' : limit}
          </span>
        </div>
        <div style={{ background: '#F3F4F6', borderRadius: '999px', height: '6px' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: color, transition: 'width 0.4s' }} />
        </div>
      </div>
    )
  }

  function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>{sub}</div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>Usage & Analytics</h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, background: '#EEF2FF', padding: '4px 12px', borderRadius: '999px' }}>
          {tierLabel} plan
        </div>
      </div>

      {/* Monthly quota meters */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>This month's usage</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Meter label="Candidate imports" current={usage.imports} limit={limits.imports_per_month} color="#6366F1" />
          <Meter label="AI chat sessions" current={usage.chats} limit={limits.chats_per_month} color="#10B981" />
        </div>
        {tier !== 'scale' && (
          <a href="/onboarding/payment" style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
            Upgrade for more →
          </a>
        )}
      </div>

      {/* Aggregate stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatCard label="Total candidates" value={totalCandidates ?? 0} />
        <StatCard label="Scored candidates" value={scoredCandidates ?? 0} sub={`${totalCandidates ? Math.round(((scoredCandidates ?? 0) / totalCandidates) * 100) : 0}% of pool`} />
        <StatCard label="Chat response rate" value={`${chatResponseRate}%`} sub={`${chatsCompleted ?? 0} of ${chatsSent ?? 0} replied`} />
        <StatCard label="Pipeline conversion" value={`${pipelineConversion}%`} sub={`${hiredCount ?? 0} hired`} />
      </div>

      {/* Annual billing promo */}
      {(company as any).billing_cycle !== 'annual' && (
        <div style={{ background: '#FEF9C3', border: '1px solid #EAB308', borderRadius: '10px', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Switch to annual billing — save 2 months</div>
            <div style={{ fontSize: '0.85rem', color: '#854D0E' }}>Pay for 10 months, get 12. Same features, better price.</div>
          </div>
          <a href="/onboarding/payment?billing=annual" style={{ background: '#EAB308', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Switch to annual
          </a>
        </div>
      )}
    </div>
  )
}
