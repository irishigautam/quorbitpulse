/**
 * mo9 — Internal admin panel (user + revenue view).
 * Protected by ADMIN_SECRET env var — passed ONLY via X-Admin-Secret header.
 *
 * SECURITY: ?secret= query-param access was removed — URL params appear in
 * Vercel access logs, browser history, and referrer headers, which would
 * expose the secret. Use a tool like Postman or curl with -H for access.
 *
 * Access: curl -H "x-admin-secret: <ADMIN_SECRET>" https://pulse.thequorbit.com/admin
 */

import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const h = await headers()
  const secret = h.get('x-admin-secret')
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret || secret !== adminSecret) {
    redirect('/')
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

  const active = (companies ?? []).filter(c => c.plan_active).length
  const annual = (companies ?? []).filter(c => c.billing_cycle === 'annual').length
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
            {(companies ?? []).map((c, i) => {
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
