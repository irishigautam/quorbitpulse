/**
 * HTML fallback scraper for career pages that don't use a known ATS.
 * Uses heuristics to find job listings in page HTML.
 *
 * Strategy:
 * 1. Fetch the career page HTML
 * 2. Look for JSON-LD structured data (Schema.org JobPosting)
 * 3. Look for common job listing link patterns
 * 4. Extract title + URL from each match
 */

import type { RawJobListing } from '../dedup'

interface JsonLdJobPosting {
  '@type': string
  title?: string
  name?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  } | Array<{ address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }>
  description?: string
  datePosted?: string
  url?: string
  directApply?: boolean
  employmentType?: string
  jobLocationType?: string   // 'TELECOMMUTE' = remote
}

export async function scrapeCareerPageHtml(
  careerUrl: string,
  companyName: string
): Promise<RawJobListing[]> {
  const html = await fetchWithTimeout(careerUrl)
  if (!html) return []

  // Strategy 1: JSON-LD structured data
  const jsonLdJobs = extractJsonLd(html, companyName, careerUrl)
  if (jsonLdJobs.length > 0) {
    console.log(`HTML scraper [${companyName}]: ${jsonLdJobs.length} jobs from JSON-LD`)
    return jsonLdJobs
  }

  // Strategy 2: Link-based heuristics
  const linkJobs = extractJobLinks(html, companyName, careerUrl)
  console.log(`HTML scraper [${companyName}]: ${linkJobs.length} jobs from link heuristics`)
  return linkJobs
}

// ── JSON-LD extraction ──────────────────────────────────────────────────────

function extractJsonLd(html: string, companyName: string, baseUrl: string): RawJobListing[] {
  const results: RawJobListing[] = []
  const scriptPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

  let match: RegExpExecArray | null
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const items: JsonLdJobPosting[] = Array.isArray(data)
        ? data
        : data['@graph']
          ? data['@graph']
          : [data]

      for (const item of items) {
        if (item['@type'] !== 'JobPosting') continue

        const location = extractLocation(item)
        const isRemote = item.jobLocationType === 'TELECOMMUTE' || /remote/i.test(location)

        results.push({
          title:           item.title || item.name || 'Unknown',
          company_name:    item.hiringOrganization?.name || companyName,
          location,
          description:     item.description ? stripHtml(item.description).slice(0, 5000) : null,
          url:             item.url || baseUrl,
          salary_min:      null,
          salary_max:      null,
          salary_currency: 'USD',
          remote:          isRemote,
          posted_at:       item.datePosted ?? null,
          source:          'career_page',
          external_id:     `html-${hashString(companyName + (item.title || '') + (item.datePosted || ''))}`,
          skills:          [],
        })
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  return results
}

function extractLocation(item: JsonLdJobPosting): string {
  if (item.jobLocationType === 'TELECOMMUTE') return 'Remote'

  const loc = Array.isArray(item.jobLocation)
    ? item.jobLocation[0]
    : item.jobLocation

  if (!loc?.address) return 'Unknown'
  const { addressLocality, addressRegion, addressCountry } = loc.address
  return [addressLocality, addressRegion, addressCountry].filter(Boolean).join(', ') || 'Unknown'
}

// ── Link-based heuristics ──────────────────────────────────────────────────

const JOB_LINK_PATTERN = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
const JOB_URL_KEYWORDS = /\/(jobs?|careers?|openings?|positions?|roles?|vacancies?|opportunities?|postings?)\//i
const JOB_TITLE_INDICATORS = /engineer|developer|manager|analyst|designer|scientist|architect|lead|senior|junior|intern|product|data|devops|qa|support|sales|marketing/i

function extractJobLinks(html: string, companyName: string, baseUrl: string): RawJobListing[] {
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const results: RawJobListing[] = []

  let match: RegExpExecArray | null
  while ((match = JOB_LINK_PATTERN.exec(html)) !== null) {
    const [, href, rawText] = match
    const text = stripHtml(rawText).trim()

    if (!text || text.length < 5 || text.length > 150) continue
    if (!JOB_TITLE_INDICATORS.test(text)) continue

    let fullUrl: string
    try {
      fullUrl = href.startsWith('http') ? href : new URL(href, base).toString()
    } catch {
      continue
    }

    if (seen.has(fullUrl)) continue
    // Skip links that go to completely different domains
    try {
      const u = new URL(fullUrl)
      if (u.hostname !== base.hostname && !JOB_URL_KEYWORDS.test(u.hostname)) continue
    } catch {
      continue
    }

    seen.add(fullUrl)
    results.push({
      title:           text,
      company_name:    companyName,
      location:        'Unknown',
      description:     null,
      url:             fullUrl,
      salary_min:      null,
      salary_max:      null,
      salary_currency: 'USD',
      remote:          /remote/i.test(text),
      posted_at:       null,
      source:          'career_page',
      external_id:     `html-${hashString(fullUrl)}`,
      skills:          [],
    })

    if (results.length >= 200) break  // cap at 200 per page
  }

  return results
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 12_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QuorbitPulse/1.0; +https://pulse.thequorbit.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

function hashString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h).toString(16).padStart(8, '0')
}
