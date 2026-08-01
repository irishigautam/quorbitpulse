import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import CopyLinkButton from './CopyLinkButton'
import ApplyButton from './ApplyButton'
import { jobIdFromSlug, jobSlug } from '@/types'
import type { Metadata } from 'next'
import Link from 'next/link'

export const revalidate = 60

interface Props {
  params: { slug: string }
}

async function getJob(slug: string) {
  const id8 = jobIdFromSlug(slug)
  const supabase = await createClient()

  // `id` is a uuid column — plain ILIKE against it fails with
  // "operator does not exist: uuid ~~* unknown" (Postgres has no ILIKE for
  // uuid). This 404'd every single job detail page in production (confirmed
  // via direct SQL during the Gate 6 smoke test). Tried `.ilike('id::text', ...)`
  // expecting PostgREST to cast the column, but that produced the identical
  // 42883 error in prod, so the cast wasn't reaching Postgres — not relying
  // on that. Instead, since id8 is exactly the first 8 hex chars of the uuid
  // (the standard 8-4-4-4-12 format), a range match on those native uuid
  // comparison operators (which ARE defined, unlike ILIKE) finds the same
  // row with no pattern matching or casting involved.
  const lo = `${id8}-0000-0000-0000-000000000000`
  const hi = `${id8}-ffff-ffff-ffff-ffffffffffff`

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*, company:companies(*)')
    .eq('status', 'active')
    .gte('id', lo)
    .lte('id', hi)
    .limit(5)

  if (error) {
    console.error('[jobs/[slug]] getJob query failed:', error)
    return null
  }

  // Find the job whose slug matches exactly (id8 is only a prefix, so in the
  // rare case of a collision across multiple active jobs, don't just grab jobs[0])
  return jobs?.find(j => jobSlug(j).endsWith(id8)) ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params
  const job = await getJob(p.slug)
  if (!job) return {}
  return {
    title: `${job.title} at ${job.company.name}`,
    description: `${job.title} — ${job.location}${job.remote ? ' (Remote OK)' : ''}. Apply now on JobPulse.`,
  }
}

function formatSalary(min: number | null, max: number | null, currency: string) {
  if (!min && !max) return null
  const fmt = (n: number) => currency === 'INR' ? `₹${(n / 100000).toFixed(1)}L` : `${currency} ${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)} / year`
  if (min) return `From ${fmt(min)} / year`
  return `Up to ${fmt(max!)} / year`
}

export default async function JobPage({ params }: Props) {
  const p = await params
  const job = await getJob(p.slug)
  if (!job) notFound()

  const { company } = job
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.io'

  // Schema.org JobPosting
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.posted_at,
    validThrough: job.expires_at,
    employmentType: job.job_type.toUpperCase().replace('_', '_'),
    hiringOrganization: {
      '@type': 'Organization',
      name: company.name,
      sameAs: company.website,
      ...(company.logo_url ? { logo: company.logo_url } : {}),
    },
    jobLocation: job.remote
      ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location } }
      : { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location } },
    ...(job.remote ? { jobLocationType: 'TELECOMMUTE' } : {}),
    ...(salary && job.salary_min ? {
      baseSalary: {
        '@type': 'MonetaryAmount',
        currency: job.salary_currency,
        value: {
          '@type': 'QuantitativeValue',
          minValue: job.salary_min,
          maxValue: job.salary_max,
          unitText: 'YEAR',
        },
      }
    } : {}),
    ...(job.apply_url ? { applicationContact: { '@type': 'ContactPoint', url: job.apply_url } } : {}),
  }

  // Increment views (fire and forget). Two real bugs found here during the
  // Gate 6 smoke test, previously masked by getJob() always 404ing before
  // ever reaching this line: (1) supabase.rpc(...) returns a PostgrestFilterBuilder,
  // which is thenable but has no .catch() method — `.catch(() => {})` threw
  // "TypeError: ...rpc(...).catch is not a function" and 500'd the whole page.
  // (2) same un-awaited-fire-and-forget risk as jobs/create/route.ts — no
  // guarantee it finishes before Vercel freezes the function. `after()` plus
  // `await`-ing the builder (not calling .catch on it) fixes both.
  const supabase = await createClient()
  after(async () => {
    try {
      await supabase.rpc('increment_job_views', { job_id: job.id })
    } catch (err) {
      console.error('[jobs/[slug]] increment_job_views failed:', err)
    }
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--navy)' }}>
              JobPulse
            </Link>
            <Link href="/jobs" className="text-sm hover:opacity-75" style={{ color: 'var(--accent)' }}>
              ← Back to all jobs
            </Link>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main content */}
            <article className="flex-1 bg-white rounded-2xl border p-6">
              {/* Company */}
              <div className="flex items-center gap-3 mb-4">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.name} className="w-12 h-12 rounded-xl object-contain border" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ background: 'var(--navy)' }}
                  >
                    {company.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold">{company.name}</p>
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                    {company.website.replace(/^https?:\/\//, '')} ↗
                  </a>
                </div>
              </div>

              <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                {job.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm px-3 py-1 rounded-full bg-gray-100 capitalize">
                  {job.job_type.replace('_', '-')}
                </span>
                <span className="text-sm px-3 py-1 rounded-full bg-gray-100">
                  📍 {job.location}
                </span>
                {job.remote && (
                  <span className="text-sm px-3 py-1 rounded-full text-blue-700" style={{ background: 'var(--accent-light)' }}>
                    Remote OK
                  </span>
                )}
                {salary && (
                  <span className="text-sm px-3 py-1 rounded-full bg-green-50 text-green-700">
                    💰 {salary}
                  </span>
                )}
              </div>

              {/* Skills */}
              {job.skills.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>
                    Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((s: string) => (
                      <span key={s} className="text-sm px-3 py-1 rounded-full border bg-gray-50">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="border-t pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted)' }}>
                  About this role
                </p>
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </div>

              {/* Posted date */}
              <p className="text-xs mt-6 pt-4 border-t" style={{ color: 'var(--muted)' }}>
                Posted {new Date(job.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                Expires {new Date(job.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </article>

            {/* Sidebar */}
            <aside className="lg:w-72 space-y-4">
              {/* Apply card */}
              <div className="bg-white rounded-2xl border p-5 sticky top-6">
                <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Apply for this role
                </h2>
                <ApplyButton jobId={job.id} jobSlug={p.slug} />

                {(job.apply_url || job.apply_email) && (
                  <div className="mt-3 pt-3 border-t text-xs text-center" style={{ color: 'var(--muted)' }}>
                    Also accepts applications{' '}
                    {job.apply_url && (
                      <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent)' }}>
                        via this link
                      </a>
                    )}
                    {job.apply_url && job.apply_email && ' or '}
                    {job.apply_email && (
                      <a href={`mailto:${job.apply_email}?subject=Application for ${encodeURIComponent(job.title)}`} className="underline" style={{ color: 'var(--accent)' }}>
                        via email
                      </a>
                    )}
                  </div>
                )}

                {/* Share */}
                <CopyLinkButton url={`${appUrl}/jobs/${p.slug}`} />
              </div>

              {/* Company card */}
              {company.description && (
                <div className="bg-white rounded-2xl border p-5">
                  <h3 className="font-semibold mb-2 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    About {company.name}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                    {company.description}
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>

        <footer className="text-center py-6 text-xs border-t mt-4" style={{ color: 'var(--muted)' }}>
          Powered by{' '}
          <a href="https://quorbit.com" target="_blank" rel="noopener noreferrer" className="underline">
            Quorbit
          </a>
        </footer>
      </div>
    </>
  )
}
