/**
 * QA-audit fix: this page previously rendered its client component directly
 * with no server-side gate of its own - the only protection was whatever the
 * underlying API routes happened to check, which (until this same fix) was
 * just requireCompany(), letting any customer view/manage a shared,
 * platform-wide scraping pipeline (career_page_sources has no company_id
 * column at all). The API routes are now restricted to the admin allowlist
 * (see app/api/job-sources/route.ts), and this page adds a matching
 * server-side check so a non-staff visitor sees a clear message instead of a
 * client component that loads and then silently 403s on every request.
 */

import { requireCompany } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin-auth'
import JobSourcesClient from './JobSourcesClient'

export const dynamic = 'force-dynamic'

export default async function JobSourcesPage() {
  await requireCompany()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isAdminEmail(user?.email)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>
          Not available
        </h1>
        <p>Job Sources manages Quorbit&#39;s internal candidate-sourcing pipeline and isn&#39;t part of your company account.</p>
      </div>
    )
  }

  return <JobSourcesClient />
}
