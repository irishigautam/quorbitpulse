/**
 * ExternalJobCard — renders a scraped job from job_listings.
 * Links directly to the external job URL (no internal slug).
 */

const SOURCE_LABEL: Record<string, string> = {
  adzuna:      'Adzuna',
  serpapi:     'Google Jobs',
  remotive:    'Remotive',
  arbeitnow:   'Arbeitnow',
  jobicy:      'Jobicy',
  career_page: 'Company',
}

interface ExternalJob {
  id: string
  title: string
  company_name: string
  location: string
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  skills: string[]
  posted_at: string | null
  url: string
  source: string
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return 'Recently'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function formatSalary(min: number | null, max: number | null, currency: string) {
  if (!min && !max) return null
  const fmt = (n: number) => currency === 'INR'
    ? `₹${(n / 100000).toFixed(1)}L`
    : `${currency} ${n.toLocaleString()}`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

export default function ExternalJobCard({ job }: { job: ExternalJob }) {
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency)
  const topSkills = (job.skills ?? []).slice(0, 3)
  const initials = job.company_name.slice(0, 2).toUpperCase()
  const sourceLabel = SOURCE_LABEL[job.source] ?? job.source

  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      <div className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          {/* Company initial avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ background: 'var(--navy)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--muted)' }}>
              {job.company_name}
            </p>
            <h3 className="font-semibold text-sm leading-snug mt-0.5 truncate">{job.title}</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
            {job.location}
          </span>
          {job.remote && (
            <span className="text-xs px-2 py-0.5 rounded-full text-blue-700" style={{ background: 'var(--accent-light)' }}>
              Remote
            </span>
          )}
        </div>

        {topSkills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topSkills.map(skill => (
              <span key={skill} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 border">
                {skill}
              </span>
            ))}
            {(job.skills ?? []).length > 3 && (
              <span className="text-xs px-2 py-0.5" style={{ color: 'var(--muted)' }}>
                +{job.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
          <span>{timeAgo(job.posted_at)}</span>
          <div className="flex items-center gap-2">
            {salary && <span className="font-medium">{salary}</span>}
            {sourceLabel && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ background: '#F3F4F6', color: '#6B7280', fontSize: '0.65rem' }}
              >
                via {sourceLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}
