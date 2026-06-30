import { requireCompany } from '@/lib/auth'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { company, role } = await requireCompany()

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/onboarding/signup')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-bold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}
          >
            JobPulse
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="hover:opacity-75 font-medium">
              Overview
            </Link>
            <Link href="/dashboard/jobs" className="hover:opacity-75 font-medium">
              Jobs
            </Link>
            <Link href="/dashboard/candidates" className="hover:opacity-75 font-medium">
              Candidates
            </Link>
            <Link href="/dashboard/pipeline" className="hover:opacity-75 font-medium">
              Pipeline
            </Link>
            <Link href="/dashboard/integrations" className="hover:opacity-75 font-medium">
              Integrations
            </Link>
            {role === 'admin' && (
              <Link href="/dashboard/team" className="hover:opacity-75 font-medium">
                Team
              </Link>
            )}
            <Link href="/dashboard/post" className="hover:opacity-75 font-medium" style={{ color: 'var(--accent)' }}>
              + Post a Job
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:block" style={{ color: 'var(--muted)' }}>
            {company.name}
          </span>
          <Link
            href={`/company/${(company as any).slug ?? ''}`}
            target="_blank"
            className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50"
          >
            Company page ↗
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="text-center py-6 text-xs" style={{ color: 'var(--muted)' }}>
        Powered by{' '}
        <a href="https://quorbit.com" target="_blank" rel="noopener noreferrer" className="underline">
          Quorbit
        </a>
      </footer>
    </div>
  )
}
