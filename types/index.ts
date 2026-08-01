export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance'
export type JobStatus = 'active' | 'expired' | 'draft'

export interface Company {
  id: string
  name: string
  website: string
  logo_url: string | null
  careers_email: string | null
  description: string | null
  verified: boolean
  plan_active: boolean
  plan_expires_at: string | null
  plan_tier: string | null
  jobs_quota: number
  jobs_used: number
  razorpay_subscription_id: string | null
  hrms_webhook_secret: string | null
  slug: string | null
  created_at: string
}

export interface Job {
  id: string
  company_id: string
  title: string
  description: string
  requirements: string | null
  location: string
  job_type: JobType
  remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  skills: string[]
  domain: string[]
  min_experience: number
  apply_url: string | null
  apply_email: string | null
  status: JobStatus
  views: number
  posted_at: string
  expires_at: string
  google_indexed: boolean
  distributed_at: string | null
  distribution_channels: Record<string, { status: string; url?: string; error?: string; distributed_at: string }> | null
  fingerprint: string | null
  distributed_fingerprint: string | null
  sync_status: 'not_distributed' | 'stale' | 'synced' | 'partial' | 'failed'
  // Joined field (not in DB column)
  company?: Company
}

export interface ApiKey {
  id: string
  company_id: string
  key_hash: string
  label: string | null
  created_at: string
}

// ---- API response shapes ----

export interface JobsListResponse {
  data: Job[]
  total: number
  limit: number
  offset: number
}

// ---- Form types ----

export interface PostJobFormValues {
  title: string
  job_type: JobType
  location: string
  remote: boolean
  skills: string[]
  domain: string[]
  min_experience: number
  salary_min: string
  salary_max: string
  salary_currency: string
  description: string
  // Optional, structured "must-haves" list — kept distinct from description
  // so employers can separate role narrative from a hard requirements list.
  requirements: string
  // Candidates always apply on-platform (via /api/candidate/apply) so every
  // application carries real profile data for AI scoring — an external
  // apply_url/mailto bypass would mean no candidate record, no fingerprint,
  // and no score. These are now purely optional supplementary channels an
  // employer may also list (e.g. "or email us directly"), never a
  // requirement, and never the primary apply action shown to candidates.
  apply_url: string
  apply_email: string
}

export interface SignupFormValues {
  company_name: string
  website: string
  careers_email: string
  password: string
}

// ---- Candidate Import ----

export type ImportSource = 'csv' | 'linkedin_ext' | 'apollo' | 'naukri_ext'
export type CandidateStatus = 'new' | 'scored' | 'chatted' | 'in_pipeline' | 'rejected' | 'hired'
export type PipelineStage = 'sourced' | 'screened' | 'interview' | 'offer' | 'hired' | 'rejected'
export type SeniorityLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal'

export interface ImportedCandidate {
  id: string
  company_id: string
  full_name: string
  email: string | null
  linkedin_url: string | null
  current_title: string | null
  current_company: string | null
  location: string | null
  phone: string | null
  notes: string | null
  import_source: ImportSource
  import_batch_id: string | null
  // Fingerprint — Phase 1 (basic, from CSV columns)
  domain: string[]
  seniority: SeniorityLevel | null
  skills: string[]
  years_experience: number | null
  resume_file_path: string | null
  fingerprint_at: string | null
  // AI Scoring — Phase 2
  ai_fingerprint: Record<string, unknown> | null
  fingerprint_status: 'pending' | 'processing' | 'done' | 'failed'
  match_score: number | null          // best score across all assigned jobs (0–100)
  blended_score: number | null        // 70% match_score + 30% chat readiness (lc6)
  score_breakdown: Record<string, unknown> | null
  // LLM export enrichment — lc8
  llm_export_processed_at: string | null
  llm_export_summary: string | null
  llm_export_source: 'chatgpt' | 'claude' | null
  // Candidate consent for LLM export analysis — Gate 1
  llm_consent_status: 'none' | 'pending' | 'approved' | 'denied'
  llm_consent_requested_at: string | null
  llm_consent_responded_at: string | null
  llm_consent_expires_at: string | null
  fingerprinted_at: string | null
  scored_at: string | null
  status: CandidateStatus
  created_at: string
  updated_at: string
  // Joined
  assignments?: CandidateJobAssignment[]
}

export interface CandidateJobAssignment {
  id: string
  candidate_id: string
  job_id: string
  company_id: string
  // Scores (Phase 2)
  match_score: number | null
  domain_score: number | null
  seniority_score: number | null
  skill_score: number | null
  experience_score: number | null
  score_breakdown: Record<string, unknown> | null
  // Chat (Phase 3)
  chat_sent_at: string | null
  chat_completed_at: string | null
  chat_score: number | null
  chat_summary: string | null
  // Pipeline
  pipeline_stage: PipelineStage
  recruiter_notes: string | null
  tags: string[]
  starred: boolean
  created_at: string
  updated_at: string
  // Joined
  candidate?: ImportedCandidate
  job?: Pick<Job, 'id' | 'title' | 'domain' | 'skills' | 'min_experience'>
}

export interface ImportBatch {
  id: string
  company_id: string
  source: ImportSource
  filename: string | null
  total_rows: number
  inserted: number
  skipped_dups: number
  failed: number
  status: 'processing' | 'complete' | 'failed'
  created_at: string
}

export interface ImportResult {
  batch_id: string
  total_rows: number
  inserted: number
  skipped_dups: number
  failed: number
  candidates: ImportedCandidate[]
}

// CSV row shape (before normalisation)
export interface CsvCandidateRow {
  full_name?: string
  name?: string
  email?: string
  linkedin_url?: string
  linkedin?: string
  current_title?: string
  title?: string
  current_company?: string
  company?: string
  location?: string
  phone?: string
  notes?: string
  [key: string]: string | undefined
}

// ---- Candidate Profile (candidate-side auth) ----

export type SelfServiceStatus = 'incomplete' | 'active' | 'hidden'

export interface CandidateProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  location: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  github_url: string | null
  current_title: string | null
  current_company: string | null
  resume_url: string | null
  resume_file_path: string | null
  resume_text: string | null
  public_slug: string           // URL-safe unique slug for /candidate/profile/[slug]
  status: SelfServiceStatus
  // Fingerprint (extracted from resume)
  skills: string[]
  domain: string[]
  seniority: SeniorityLevel | null
  years_experience: number | null
  fingerprint_summary: string | null
  resume_processed_at: string | null
  // Self-service AI work history upload (own ChatGPT/Claude export)
  llm_export_processed_at: string | null
  llm_export_summary: string | null
  llm_export_source: string | null
  // LinkedIn enrichment
  projects: { name: string; description: string; url: string | null }[]
  certifications: { name: string; issuer: string; issued_at: string | null }[]
  publications: { title: string; url: string | null; published_at: string | null }[]
  linkedin_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface CandidateApplication {
  id: string
  candidate_id: string
  job_id: string
  company_id: string
  match_score: number | null
  status: 'pending' | 'viewed' | 'shortlisted' | 'rejected'
  applied_at: string
  // Joined
  job?: Pick<Job, 'id' | 'title' | 'location' | 'job_type' | 'remote' | 'company'>
}

// ---- Subscription / Metering ----

export type PlanTier = 'starter' | 'growth' | 'scale'

export interface PlanLimits {
  imports_per_month: number      // -1 = unlimited
  chats_per_month: number        // -1 = unlimited
  jobs_quota: number
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: { imports_per_month: 50,  chats_per_month: 20,  jobs_quota: 3  },
  growth:  { imports_per_month: 250, chats_per_month: 100, jobs_quota: 10 },
  scale:   { imports_per_month: -1,  chats_per_month: -1,  jobs_quota: 50 },
}

export interface UsageEvent {
  id: string
  company_id: string
  event_type: 'import' | 'chat' | 'score'
  metadata: Record<string, unknown> | null
  created_at: string
}

// ---- Job Supply ----

export type JobSource = 'adzuna' | 'schema_org' | 'apify' | 'direct'

export interface JobListing {
  id: string
  external_id: string | null
  source: JobSource
  title: string
  company_name: string
  location: string
  description: string | null
  url: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  skills: string[]
  domain: string[]
  seniority: SeniorityLevel | null
  min_experience: number | null
  remote: boolean
  posted_at: string | null
  expires_at: string | null
  enriched: boolean
  dedup_hash: string | null
  created_at: string
}

// ---- Slug helpers ----
export function jobSlug(job: Pick<Job, 'id' | 'title'>): string {
  const titleSlug = job.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${titleSlug}-${job.id.slice(0, 8)}`
}

export function jobIdFromSlug(slug: string): string {
  return slug.slice(-8)
}
