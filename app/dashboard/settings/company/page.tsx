/**
 * P0-002 — Company profile settings.
 *
 * Website, name, careers_email, logo, and description were captured once
 * at signup with no way to view or edit them afterward. Admin-only since
 * this is organization-wide (job postings and distribution reference it).
 */

import { requireRole } from '@/lib/auth'
import CompanySettingsClient from './CompanySettingsClient'

export const dynamic = 'force-dynamic'

export default async function CompanySettingsPage() {
  const { company } = await requireRole('admin')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>
        Company profile
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Shown on your public company page and used across job postings.
      </p>
      <CompanySettingsClient company={{
        name: company.name,
        website: company.website,
        careers_email: company.careers_email,
        logo_url: company.logo_url,
        description: company.description,
      }} />
    </div>
  )
}
