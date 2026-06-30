/**
 * s2 — Google Jobs Schema.org parser.
 * Extracts JobPosting structured data from any webpage that emits it.
 * Legally defensible: reads machine-readable data companies explicitly publish.
 */

export interface SchemaJobPosting {
  title: string
  description: string
  datePosted: string | null
  validThrough: string | null
  employmentType: string | null
  hiringOrganization: { name: string; sameAs?: string } | null
  jobLocation: { addressLocality?: string; addressRegion?: string; addressCountry?: string } | null
  baseSalary?: { value?: { minValue?: number; maxValue?: number; unitText?: string }; currency?: string } | null
  directApply?: boolean
  url?: string
}

export interface ParsedJobPosting {
  title: string
  company_name: string
  location: string
  description: string
  url: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  remote: boolean
  posted_at: string | null
  expires_at: string | null
  employment_type: string | null
}

/**
 * Parse JobPosting LD+JSON from raw HTML.
 * Extracts all JobPosting blocks from <script type="application/ld+json"> tags.
 */
export function parseJobPostingsFromHtml(html: string, pageUrl: string): ParsedJobPosting[] {
  const results: ParsedJobPosting[] = []

  // Match all LD+JSON script blocks
  const ldPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = ldPattern.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1])
      const items: any[] = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw]

      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue
        const parsed = normalisePosting(item, pageUrl)
        if (parsed) results.push(parsed)
      }
    } catch {
      // malformed JSON — skip
    }
  }

  return results
}

function normalisePosting(item: any, pageUrl: string): ParsedJobPosting | null {
  const title = item.title ?? item.name
  if (!title) return null

  const company = item.hiringOrganization?.name ?? ''
  const loc = item.jobLocation?.address ?? item.jobLocation ?? {}
  const location = [
    loc.addressLocality,
    loc.addressRegion,
    loc.addressCountry,
  ].filter(Boolean).join(', ') || 'India'

  const remote = (item.jobLocationType === 'TELECOMMUTE') ||
    location.toLowerCase().includes('remote') ||
    (item.employmentType ?? '').toLowerCase().includes('remote')

  const salary = item.baseSalary ?? {}
  const salaryValue = salary.value ?? salary
  const salMin = salaryValue.minValue ?? null
  const salMax = salaryValue.maxValue ?? salaryValue.value ?? null
  const salCurrency = salary.currency ?? 'INR'

  return {
    title,
    company_name: company,
    location,
    description: stripHtml(item.description ?? ''),
    url: item.url ?? pageUrl,
    salary_min: salMin ? Math.round(Number(salMin)) : null,
    salary_max: salMax ? Math.round(Number(salMax)) : null,
    salary_currency: salCurrency,
    remote,
    posted_at:  item.datePosted ?? null,
    expires_at: item.validThrough ?? null,
    employment_type: normaliseEmploymentType(item.employmentType),
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
}

function normaliseEmploymentType(raw: string | string[] | null | undefined): string | null {
  if (!raw) return null
  const types = Array.isArray(raw) ? raw : [raw]
  const first = types[0]?.toLowerCase() ?? ''
  if (first.includes('full')) return 'full_time'
  if (first.includes('part')) return 'part_time'
  if (first.includes('contract')) return 'contract'
  if (first.includes('intern')) return 'internship'
  return first || null
}
