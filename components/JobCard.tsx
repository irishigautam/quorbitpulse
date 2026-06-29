import Link from 'next/link'
import type { Job, Company } from '@/types'
import { jobSlug } from '@/types'

interface Props {
  job: Job & { company: Company }
}

function timeAgo(dateStr: string) {
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

function CompanyLogo({ company }: { company: Company }) {
  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={company.name}
        className="w-10 h-10 rounded-lg object-contain border bg-white"
      />
    )
  }
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ background: 'var(--navy)' }}
    >
      {company.name.slice(0, 2).toUpperCase()}
    </div>
  )
}

export default function JobCard({ job }: Props) {
  const slug = jobSlug(job)
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency)
  const topSkills = job.skills.slice(0, 3)

  return (
    <Link href={`/jobs/${slug}`}>
      <div className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          <CompanyLogo company={job.company} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--muted)' }}>
              {job.company.name}
            </p>
            <h3 className="font-semibold text-sm leading-snug mt-0.5 truncate">{job.title}</h3>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 capitalize">
            {job.job_type.replace('_', '-')}
          </span>
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
            {job.skills.length > 3 && (
              <span className="text-xs px-2 py-0.5" style={{ color: 'var(--muted)' }}>
                +{job.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
          <span>{timeAgo(job.posted_at)}</span>
          {salary && <span className="font-medium">{salary}</span>}
        </div>
      </div>
    </Link>
  )
}
