/**
 * Phase 2 — Match Scoring Engine
 *
 * Weighted algorithm (0–100):
 *   Domain match   30 pts  (exact=30, adjacent=18, none=0)
 *   Seniority      20 pts  (exact=20, ±1=12, ±2=0)
 *   Skill overlap  25 pts  (matched / required * 25)
 *   YOE            25 pts  (meets min=25, partial for shortfall, 0 if >3 yrs short)
 */

import type { Job } from '@/types'
import type { CandidateFingerprint } from './fingerprint'

const DOMAIN_ADJACENCY: Record<string, string[]> = {
  frontend:   ['fullstack'],
  backend:    ['fullstack', 'devops', 'data_ml'],
  fullstack:  ['frontend', 'backend'],
  devops:     ['backend', 'security'],
  data_ml:    ['backend'],
  mobile:     ['frontend', 'fullstack'],
  design:     ['product', 'frontend'],
  product:    ['design', 'marketing'],
  marketing:  ['product', 'sales'],
  sales:      ['marketing'],
  salesforce: ['sales', 'backend'],
  security:   ['devops', 'backend'],
}

const SENIORITY_ORDER: Record<string, number> = {
  intern:    0,
  junior:    1,
  mid:       2,
  senior:    3,
  lead:      4,
  principal: 5,
}

export interface ScoreBreakdown {
  total:             number
  domain_score:      number
  seniority_score:   number
  skill_score:       number
  yoe_score:         number
  domain_match_type: 'exact' | 'adjacent' | 'none'
  seniority_gap:     number
  matched_skills:    string[]
  missing_skills:    string[]
  candidate_domains: string[]
  job_domains:       string[]
  candidate_seniority: string | null
  job_min_experience:  number
  candidate_yoe:       number | null
}

function scoreDomain(candidateDomains: string[], jobDomains: string[]):
  { score: number; type: 'exact' | 'adjacent' | 'none' } {
  if (!jobDomains.length) return { score: 15, type: 'exact' }
  if (candidateDomains.some(cd => jobDomains.includes(cd))) return { score: 30, type: 'exact' }
  if (candidateDomains.some(cd => (DOMAIN_ADJACENCY[cd] ?? []).some(jd => jobDomains.includes(jd))))
    return { score: 18, type: 'adjacent' }
  return { score: 0, type: 'none' }
}

function yoeToSeniority(yoe: number): string {
  if (yoe <= 0) return 'intern'; if (yoe <= 1) return 'junior'
  if (yoe <= 3) return 'mid'; if (yoe <= 6) return 'senior'
  if (yoe <= 10) return 'lead'; return 'principal'
}

function scoreSeniority(candidateSeniority: string | null, jobMinExperience: number):
  { score: number; gap: number } {
  if (!candidateSeniority) return { score: 10, gap: 0 }
  const cLevel = SENIORITY_ORDER[candidateSeniority] ?? 2
  const jLevel = SENIORITY_ORDER[yoeToSeniority(jobMinExperience)] ?? 2
  const gap = Math.abs(cLevel - jLevel)
  if (gap === 0) return { score: 20, gap: 0 }
  if (gap === 1) return { score: 12, gap: 1 }
  if (gap === 2) return { score: 4, gap: 2 }
  return { score: 0, gap }
}

function scoreSkills(candidateSkills: string[], jobSkills: string[]):
  { score: number; matched: string[]; missing: string[] } {
  if (!jobSkills.length) return { score: 25, matched: [], missing: [] }
  const norm = (s: string) => s.toLowerCase().trim()
  const cSet = new Set(candidateSkills.map(norm))
  const matched: string[] = [], missing: string[] = []
  for (const s of jobSkills) (cSet.has(norm(s)) ? matched : missing).push(s)
  return { score: Math.round(matched.length / jobSkills.length * 25), matched, missing }
}

function scoreYoe(candidateYoe: number | null, jobMinExperience: number): number {
  if (candidateYoe === null) return 12
  if (jobMinExperience === 0) return 25
  const ratio = candidateYoe / jobMinExperience
  if (ratio >= 1) return 25; if (ratio >= 0.75) return 18
  if (ratio >= 0.5) return 10; return 0
}

export function computeMatchScore(
  fingerprint: CandidateFingerprint,
  job: Pick<Job, 'domain' | 'skills' | 'min_experience'>,
): ScoreBreakdown {
  const { score: domain_score, type: domain_match_type } = scoreDomain(fingerprint.domain, job.domain)
  const { score: seniority_score, gap: seniority_gap } = scoreSeniority(fingerprint.seniority, job.min_experience)
  const { score: skill_score, matched: matched_skills, missing: missing_skills } = scoreSkills(fingerprint.skills, job.skills)
  const yoe_score = scoreYoe(fingerprint.years_experience, job.min_experience)
  return {
    total: domain_score + seniority_score + skill_score + yoe_score,
    domain_score, seniority_score, skill_score, yoe_score,
    domain_match_type, seniority_gap, matched_skills, missing_skills,
    candidate_domains: fingerprint.domain, job_domains: job.domain,
    candidate_seniority: fingerprint.seniority,
    job_min_experience: job.min_experience, candidate_yoe: fingerprint.years_experience,
  }
}

export function scoreTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'Strong match', color: '#14532D', bg: '#DCFCE7' }
  if (score >= 60) return { label: 'Good match', color: '#1D4ED8', bg: '#EFF6FF' }
  if (score >= 40) return { label: 'Partial match', color: '#92400E', bg: '#FEF3C7' }
  return { label: 'Low match', color: '#991B1B', bg: '#FEF2F2' }
}
