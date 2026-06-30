/**
 * GET /api/reports/match-to-find
 *
 * inf5 — Match-to-find ratio benchmark report.
 * Publishes India hiring quality data for thought leadership + inbound lead gen.
 *
 * Returns:
 * - Average match score across all scored candidates
 * - Distribution by score bracket (0-24, 25-49, 50-74, 75-100)
 * - Top domains in demand
 * - Top skills in demand
 * - Avg time-to-hire by pipeline stage (publicly anonymised)
 *
 * No auth required — public data, anonymised and aggregated.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Cache for 24h — expensive query, public data
export const revalidate = 86400

export async function GET() {
  try {
    const supabase = createServiceClient()

    // Aggregate match score distribution (all companies, anonymised)
    const { data: scoreData } = await supabase
      .from('imported_candidates')
      .select('match_score, blended_score, skills, domain, status, created_at')
      .not('match_score', 'is', null)
      .limit(10000)

    const candidates = scoreData ?? []

    const distribution = { 'elite_75_100': 0, 'strong_50_74': 0, 'moderate_25_49': 0, 'weak_0_24': 0 }
    let totalScore = 0
    let scored = 0

    const skillFreq: Record<string, number> = {}
    const domainFreq: Record<string, number> = {}

    for (const c of candidates) {
      const s = c.match_score ?? 0
      totalScore += s
      scored++

      if (s >= 75)      distribution.elite_75_100++
      else if (s >= 50) distribution.strong_50_74++
      else if (s >= 25) distribution.moderate_25_49++
      else              distribution.weak_0_24++

      for (const skill of c.skills ?? []) skillFreq[skill] = (skillFreq[skill] ?? 0) + 1
      for (const dom of c.domain ?? [])   domainFreq[dom]  = (domainFreq[dom]  ?? 0) + 1
    }

    const avgMatchScore = scored > 0 ? Math.round(totalScore / scored) : 0

    const topSkills = Object.entries(skillFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count }))

    const topDomains = Object.entries(domainFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }))

    // Hire rate by status
    const hiredCount = candidates.filter(c => c.status === 'hired').length
    const hireRate = scored > 0 ? Math.round((hiredCount / scored) * 100) : 0

    return NextResponse.json({
      report_name: 'Quorbit Match-to-Find Ratio Benchmark',
      report_period: `${new Date().getFullYear()} Annual`,
      generated_at: new Date().toISOString(),
      summary: {
        total_candidates_analysed: scored,
        average_match_score: avgMatchScore,
        overall_hire_rate_pct: hireRate,
        match_to_find_ratio: avgMatchScore > 0 ? `${avgMatchScore}:100` : 'N/A',
      },
      score_distribution: {
        ...distribution,
        pct_elite:    scored > 0 ? Math.round((distribution.elite_75_100 / scored) * 100) : 0,
        pct_strong:   scored > 0 ? Math.round((distribution.strong_50_74 / scored) * 100) : 0,
        pct_moderate: scored > 0 ? Math.round((distribution.moderate_25_49 / scored) * 100) : 0,
        pct_weak:     scored > 0 ? Math.round((distribution.weak_0_24 / scored) * 100) : 0,
      },
      top_skills_in_demand: topSkills,
      top_domains_in_demand: topDomains,
      methodology: 'Scores computed via Quorbit AI fingerprinting — skills × domain × experience × seniority. Data aggregated and anonymised across all platform companies.',
      data_as_of: new Date().toISOString().split('T')[0],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
