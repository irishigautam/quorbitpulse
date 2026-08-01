/**
 * mo9 — Internal admin panel (user + revenue view).
 *
 * Two independent ways in:
 * 1. X-Admin-Secret header (curl/Postman, for automation/scripts) — unchanged
 *    from before. ?secret= query-param access stays removed: URL params leak
 *    into Vercel access logs, browser history, and referrer headers.
 * 2. A normal Supabase Auth session (the same login used for company/
 *    candidate accounts) whose email is on the ADMIN_EMAILS allowlist (see
 *    lib/admin-auth.ts) — added so this is actually browsable after signing
 *    in normally, not curl-only. Neither path is required over the other.
 *
 * Access: curl -H "x-admin-secret: <ADMIN_SECRET>" https://pulse.thequorbit.com/admin
 *      or sign in at /onboarding/login as an allowlisted email, then visit /admin.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const h = await headers()
  const secret = h.get('x-admin-secret')
  const adminSecret = process.env.ADMIN_SECRET
  const hasValidSecret = !!adminSecret && secret === adminSecret

  let hasAdminSession = false
  if (!hasValidSecret) {
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    hasAdminSession = isAdminEmail(user?.email)
  }

  if (!hasValidSecret && !hasAdminSession) {
    redirect('/onboarding/login?redirect=/admin')
  }

  const supabase = createServiceClient()

  // All companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, website, plan_active, plan_tier, billing_cycle, plan_expires_at, created_at, razorpay_subscription_id')
    .order('created_at', { ascending: false })
    .limit(200)

  // Usage summary per company
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { data: usage } = await supabase
    .from('usage_events')
    .select('company_id, event_type')
    .gte('created_at', monthStart.toISOString())

  const usageByCompany: Record<string, { imports: number; chats: number }> = {}
  for (const e of usage ?? []) {
    if (!usageByCompany[e.company_id]) usageByCompany[e.company_id] = { imports: 0, chats: 0 }
    if (e.event_type === 'import') usageByCompany[e.company_id].imports++
    if (e.event_type === 'chat') usageByCompany[e.company_id].chats++
  }

  // Candidate counts per company
  const { data: candidateCounts } = await supabase
    .from('imported_candidates')
    .select('company_id')

  const candByCompany: Record<string, number> = {}
  for (const c of candidateCounts ?? []) {
    candByCompany[c.company_id] = (candByCompany[c.company_id] ?? 0) + 1
  }

  // Gate 4 — funnel event baseline (last 14 days, per event type per day)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data: funnelEvents } = await supabase
    .from('funnel_events')
    .select('event_type, created_at')
    .gte('created_at', fourteenDaysAgo.toISOString())

  const FUNNEL_TYPES = [
    'company_signup', 'candidate_signup', 'job_posted', 'candidates_imported',
    'candidate_applied', 'candidates_scored', 'chat_completed', 'pipeline_stage_changed',
  ] as const

  const funnelTotals: Record<string, number> = {}
  for (const t of FUNNEL_TYPES) funnelTotals[t] = 0
  for (const e of funnelEvents ?? []) {
    funnelTotals[e.event_type] = (funnelTotals[e.event_type] ?? 0) + 1
  }

  // P0-020 — audit log (most recent 100 entries, joined to company name)
  const { data: auditRows } = await supabase
    .from('audit_log')
    .select('id, company_id, actor_id, actor_role, action, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  // P0-017 — recent failed notifications (email/webhook)
  const { data: failedNotifications } = await supabase
    .from('notification_log')
    .select('id, channel, template, company_id, recipient, error, created_at')
    .eq('status', 'error')
    .order('created_at', { ascending: false })
    .limit(50)

  // P0-022 — recent server errors (self-hosted monitoring baseline)
  const { data: errorRows } = await supabase
    .from('error_log')
    .select('id, route, message, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const companyNameById: Record<string, string> = {}
  for (const c of companies ?? []) companyNameById[c.id] = c.name

  const active = (companies ?? []).filter((c: any) => c.plan_active).length
  const annual = (companies ?? []).filter((c: any) => c.billing_cycle === 'annual').length
  const tierBreakdown: Record<string, number> = {}
  for (const c of companies ?? []) {
    const t = c.plan_tier ?? 'starter'
    tierBreakdown[t] = (tierBreakdown[t] ?? 0) + 1
  }

  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Quorbit Admin</h1>
      <p style={{ color: '#6B7280', marginBottom: '2rem', fontSize: '0.9rem' }}>Internal view — do not share</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total companies', value: (companies ?? []).length },
          { label: 'Active plans', value: active },
          { label: 'Annual billing', value: annual },
          { label: 'Tier breakdown', value: Object.entries(tierBreakdown).map(([t, n]) => `${t}: ${n}`).join(' · ') },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Funnel baseline — Gate 4, last 14 days */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Funnel — last 14 days</div>
        <p style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '1rem' }}>
          Employer: signup → job posted → candidates imported → scored → chat completed → pipeline stage changed. Candidate: signup → applied.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {FUNNEL_TYPES.map(t => (
            <div key={t} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#6B7280', textTransform: 'capitalize' }}>
                {t.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{funnelTotals[t]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit log — P0-020, most recent 100 entries */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Audit log — most recent 100</div>
        <p style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '1rem' }}>
          Who did what, to what, when — job, member, candidate, pipeline, and billing actions.
        </p>
        <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0 }}>
                {['When', 'Company', 'Actor', 'Role', 'Action', 'Target', 'Metadata'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(auditRows ?? []).length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '1rem', color: '#9CA3AF', textAlign: 'center' }}>No audit events yet</td></tr>
              ) : (auditRows ?? []).map((a: any, i: number) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>{a.company_id ? (companyNameById[a.company_id] ?? a.company_id.slice(0, 8)) : '—'}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{a.actor_id ? a.actor_id.slice(0, 8) : 'system'}</td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>{a.actor_role ?? '—'}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600 }}>{a.action}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280' }}>
                    {a.target_type ?? '—'}{a.target_id ? ` · ${a.target_id.slice(0, 8)}` : ''}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(a.metadata ?? {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed notifications — P0-017 */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Failed notifications — most recent 50</div>
        <p style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '1rem' }}>
          Emails and HRMS webhooks that failed to send. Previously these were silently swallowed by Promise.allSettled().
        </p>
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0 }}>
                {['When', 'Channel', 'Template', 'Company', 'Recipient', 'Error'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(failedNotifications ?? []).length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '1rem', color: '#9CA3AF', textAlign: 'center' }}>No failures recorded</td></tr>
              ) : (failedNotifications ?? []).map((n: any, i: number) => (
                <tr key={n.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>{n.channel}</td>
                  <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600 }}>{n.template}</td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>{n.company_id ? (companyNameById[n.company_id] ?? n.company_id.slice(0, 8)) : '—'}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280' }}>{n.recipient ?? '—'}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#991B1B', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.error ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error log — P0-022, self-hosted monitoring baseline */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '1.25rem', marginBottom: '2rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Error log — most recent 50</div>
        <p style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '1rem' }}>
          Unhandled request errors captured via instrumentation.ts (onRequestError) plus explicit logError() calls.
        </p>
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0 }}>
                {['When', 'Route', 'Message'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(errorRows ?? []).length === 0 ? (
                <tr><td colSpan={3} style={{ padding: '1rem', color: '#9CA3AF', textAlign: 'center' }}>No errors recorded</td></tr>
              ) : (errorRows ?? []).map((e: any, i: number) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                    {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{e.route ?? '—'}</td>
                  <td style={{ padding: '0.45rem 0.6rem', color: '#991B1B', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Companies table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['Company', 'Plan', 'Billing', 'Expires', 'Candidates', 'Imports/mo', 'Chats/mo', 'Joined'].map(h => (
                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(companies ?? []).map((c: any, i: number) => {
              const u = usageByCompany[c.id] ?? { imports: 0, chats: 0 }
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: '#6B7280', fontSize: '0.78rem' }}>{c.website}</div>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                      background: c.plan_active ? '#D1FAE5' : '#FEE2E2',
                      color: c.plan_active ? '#065F46' : '#991B1B',
                    }}>
                      {c.plan_active ? (c.plan_tier ?? 'starter') : 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: c.billing_cycle === 'annual' ? '#059669' : '#6B7280' }}>
                    {c.billing_cycle ?? 'monthly'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#6B7280' }}>
                    {c.plan_expires_at ? new Date(c.plan_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{candByCompany[c.id] ?? 0}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{u.imports}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>{u.chats}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#6B7280' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
