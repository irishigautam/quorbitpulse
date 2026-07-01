/**
 * Career page scraper — entry point
 *
 * Given a URL (and optional known ats_type/ats_slug from DB),
 * detects the ATS platform and fetches jobs via their public API,
 * falling back to HTML scraping for custom pages.
 *
 * ATS detection order:
 *   1. Known type from DB (fastest path)
 *   2. URL pattern matching (greenhouse.io, lever.co, ashby, etc.)
 *   3. HTML meta/script analysis
 *   4. HTML link heuristics (fallback)
 */

import type { RawJobListing } from '../dedup'
import { fetchGreenhouseJobs, detectGreenhouseSlug } from './ats/greenhouse'
import { fetchLeverJobs, detectLeverSlug } from './ats/lever'
import { fetchAshbyJobs, detectAshbySlug } from './ats/ashby'
import { fetchWorkableJobs, detectWorkableSlug } from './ats/workable'
import { fetchSmartRecruitersJobs, detectSmartRecruitersSlug } from './ats/smartrecruiters'
import { scrapeCareerPageHtml } from './html-scraper'

export type AtsType = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'html' | null

export interface ScrapeResult {
  jobs: RawJobListing[]
  ats_type: AtsType
  ats_slug: string | null
  error?: string
}

/**
 * Detect ATS type from a URL without fetching the page.
 * Returns null if unknown (will need HTML fetch to detect or use as fallback).
 */
export function detectAtsFromUrl(url: string): { ats_type: AtsType; ats_slug: string | null } {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()

    // Greenhouse
    if (host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') {
      return { ats_type: 'greenhouse', ats_slug: detectGreenhouseSlug(url) }
    }
    // Lever
    if (host === 'jobs.lever.co') {
      return { ats_type: 'lever', ats_slug: detectLeverSlug(url) }
    }
    // Ashby
    if (host === 'jobs.ashbyhq.com') {
      return { ats_type: 'ashby', ats_slug: detectAshbySlug(url) }
    }
    // Workable
    if (host === 'apply.workable.com' || host.endsWith('.workable.com')) {
      return { ats_type: 'workable', ats_slug: detectWorkableSlug(url) }
    }
    // SmartRecruiters
    if (host === 'careers.smartrecruiters.com') {
      return { ats_type: 'smartrecruiters', ats_slug: detectSmartRecruitersSlug(url) }
    }
  } catch {}
  return { ats_type: null, ats_slug: null }
}

/**
 * Detect ATS type by inspecting page HTML (for custom career URLs).
 * Called only when URL pattern didn't match a known ATS.
 */
export async function detectAtsFromHtml(url: string): Promise<{ ats_type: AtsType; ats_slug: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuorbitPulse/1.0)' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
    if (!res.ok) return { ats_type: 'html', ats_slug: null }

    const html = await res.text()

    // Check for ATS embed signatures
    if (/greenhouse\.io\/embed|boards\.greenhouse\.io/i.test(html)) {
      const slug = extractEmbedSlug(html, /boards\.greenhouse\.io\/(?:embed\/)?job_board\?for=([a-z0-9_-]+)/i)
      return { ats_type: 'greenhouse', ats_slug: slug }
    }
    if (/jobs\.lever\.co/i.test(html)) {
      const slug = extractEmbedSlug(html, /jobs\.lever\.co\/([a-z0-9_-]+)/i)
      return { ats_type: 'lever', ats_slug: slug }
    }
    if (/jobs\.ashbyhq\.com/i.test(html)) {
      const slug = extractEmbedSlug(html, /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i)
      return { ats_type: 'ashby', ats_slug: slug }
    }
    if (/workable\.com/i.test(html)) {
      const slug = extractEmbedSlug(html, /apply\.workable\.com\/([a-z0-9_-]+)/i)
      return { ats_type: 'workable', ats_slug: slug }
    }
    if (/smartrecruiters\.com/i.test(html)) {
      const slug = extractEmbedSlug(html, /careers\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/i)
      return { ats_type: 'smartrecruiters', ats_slug: slug }
    }

    return { ats_type: 'html', ats_slug: null }
  } catch {
    return { ats_type: 'html', ats_slug: null }
  }
}

function extractEmbedSlug(html: string, pattern: RegExp): string | null {
  const m = pattern.exec(html)
  return m?.[1] ?? null
}

/**
 * Main entry: scrape a career page, auto-detecting ATS if needed.
 */
export async function scrapeCareerPage(
  careerUrl: string,
  companyName: string,
  opts: {
    knownAtsType?: AtsType
    knownAtsSlug?: string | null
  } = {}
): Promise<ScrapeResult> {
  let { knownAtsType: atsType, knownAtsSlug: atsSlug } = opts

  // Step 1: resolve ATS type if not known
  if (!atsType) {
    const fromUrl = detectAtsFromUrl(careerUrl)
    if (fromUrl.ats_type) {
      atsType = fromUrl.ats_type
      atsSlug = fromUrl.ats_slug
    } else {
      const fromHtml = await detectAtsFromHtml(careerUrl)
      atsType = fromHtml.ats_type
      atsSlug = fromHtml.ats_slug
    }
  }

  // Step 2: fetch jobs via appropriate method
  try {
    let jobs: RawJobListing[] = []

    switch (atsType) {
      case 'greenhouse':
        if (!atsSlug) throw new Error('Greenhouse slug required')
        jobs = await fetchGreenhouseJobs(atsSlug)
        jobs = jobs.map(j => ({ ...j, company_name: companyName }))
        break

      case 'lever':
        if (!atsSlug) throw new Error('Lever slug required')
        jobs = await fetchLeverJobs(atsSlug)
        jobs = jobs.map(j => ({ ...j, company_name: companyName }))
        break

      case 'ashby':
        if (!atsSlug) throw new Error('Ashby slug required')
        jobs = await fetchAshbyJobs(atsSlug)
        // Ashby returns company name from API — only override if generic
        jobs = jobs.map(j => ({
          ...j,
          company_name: j.company_name === atsSlug ? companyName : j.company_name,
        }))
        break

      case 'workable':
        if (!atsSlug) throw new Error('Workable slug required')
        jobs = await fetchWorkableJobs(atsSlug)
        jobs = jobs.map(j => ({ ...j, company_name: companyName }))
        break

      case 'smartrecruiters':
        if (!atsSlug) throw new Error('SmartRecruiters slug required')
        jobs = await fetchSmartRecruitersJobs(atsSlug)
        jobs = jobs.map(j => ({ ...j, company_name: companyName }))
        break

      case 'html':
      default:
        jobs = await scrapeCareerPageHtml(careerUrl, companyName)
        break
    }

    return { jobs, ats_type: atsType, ats_slug: atsSlug ?? null }
  } catch (err) {
    const message = (err as Error).message
    console.error(`Career scraper error [${companyName}/${atsType}]:`, message)
    return { jobs: [], ats_type: atsType, ats_slug: atsSlug ?? null, error: message }
  }
}
