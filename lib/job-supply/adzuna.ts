/**
 * s1 — Adzuna India API integration.
 * Fetches job listings from Adzuna's India jobs endpoint.
 * Requires ADZUNA_APP_ID + ADZUNA_APP_KEY env vars.
 * Free tier: 250 calls/month.
 */

export interface AdzunaJob {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  description: string
  redirect_url: string
  salary_min: number | null
  salary_max: number | null
  contract_time: string | null
  created: string
}

export interface AdzunaSearchParams {
  what?: string         // keywords / title
  where?: string        // location
  category?: string     // Adzuna category slug
  distance?: number     // km radius
  max_days_old?: number // freshness filter
  page?: number
  results_per_page?: number
}

export async function fetchAdzunaJobs(params: AdzunaSearchParams): Promise<AdzunaJob[]> {
  const appId  = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY not set')

  const qs = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: String(params.results_per_page ?? 50),
    page: String(params.page ?? 1),
    content_type: 'application/json',
    ...(params.what       ? { what: params.what }             : {}),
    ...(params.where      ? { where: params.where }           : {}),
    ...(params.category   ? { category: params.category }     : {}),
    ...(params.distance   ? { distance: String(params.distance) } : {}),
    ...(params.max_days_old ? { max_days_old: String(params.max_days_old) } : {}),
  })

  const url = `https://api.adzuna.com/v1/api/jobs/in/search/${params.page ?? 1}?${qs}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Adzuna API error: ${res.status}`)

  const data = await res.json()
  return (data.results ?? []) as AdzunaJob[]
}
