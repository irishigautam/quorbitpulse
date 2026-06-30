/**
 * Integration registry — single source of truth for every platform
 * supported by JobPulse.
 *
 * connection_type:
 *   'oauth'     — user clicks Connect, goes through OAuth flow
 *   'api_key'   — user pastes API key (+ optional client_id)
 *   'feed'      — auto-active XML/RSS feed; user registers the URL once
 *   'quick'     — no API; opens portal's post form pre-filled in new tab
 */

export type ConnectionType = 'oauth' | 'api_key' | 'feed' | 'quick'
export type Region = 'global' | 'india' | 'us'

export interface IntegrationDef {
  id: string
  name: string
  logo: string          // emoji or icon identifier
  color: string         // brand hex
  description: string
  connection_type: ConnectionType
  region: Region[]
  /** For api_key type: label for the second field (if any) */
  key2_label?: string
  /** For feed type: the endpoint path on our side */
  feed_path?: string
  /** For quick type: URL template (can use {title}, {company}, {location}, {description}) */
  quick_url?: string
  /** Link to the portal's developer/API docs */
  docs_url?: string
  available: boolean    // false = coming soon
  /**
   * Managed mode: Quorbit posts on behalf of companies using platform-level
   * env var credentials. Company name is correctly attributed.
   * env_key = the env var name that enables managed mode for this platform.
   */
  supports_managed: boolean
  env_key?: string      // e.g. 'NAUKRI_API_KEY' — if set, managed mode is available
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'

export const INTEGRATIONS: IntegrationDef[] = [
  // ── Auto-active (no setup needed) ──────────────────────────────
  {
    id: 'google',
    name: 'Google Jobs',
    logo: '🔍',
    color: '#4285F4',
    description: 'Jobs appear in Google Search automatically via structured data. Always active — no setup needed.',
    connection_type: 'feed',
    region: ['global'],
    feed_path: '/jobs',
    available: true,
    supports_managed: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    logo: '🔵',
    color: '#003A9B',
    description: 'Register our XML feed in Indeed Employer Portal once. SimplyHired, Jora, and Glassdoor also ingest this feed.',
    connection_type: 'feed',
    region: ['global', 'india'],
    feed_path: '/api/feeds/indeed',
    docs_url: 'https://employers.indeed.com/p/post-jobs/xml-feed',
    available: true,
    supports_managed: true,
  },

  // ── OAuth integrations ─────────────────────────────────────────
  {
    id: 'linkedin',
    name: 'LinkedIn',
    logo: '💼',
    color: '#0A66C2',
    description: 'Post jobs to your LinkedIn Company Page. Requires connecting your own account — cannot be managed.',
    connection_type: 'oauth',
    region: ['global', 'india'],
    docs_url: 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api',
    available: true,
    supports_managed: false, // LinkedIn requires per-company OAuth
  },
  {
    id: 'wellfound',
    name: 'Wellfound (AngelList)',
    logo: '🚀',
    color: '#000000',
    description: 'Post to Wellfound startup jobs board. Requires connecting your own account.',
    connection_type: 'oauth',
    region: ['global', 'india'],
    docs_url: 'https://wellfound.com/talent/developer-docs',
    available: true,
    supports_managed: false, // Wellfound requires per-company OAuth
  },

  // ── API Key integrations ───────────────────────────────────────
  {
    id: 'naukri',
    name: 'Naukri.com',
    logo: '🟠',
    color: '#FF7555',
    description: 'India\'s largest job portal with 70M+ candidates. Managed mode available — or connect your own Naukri account for a verified company profile.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Client ID',
    docs_url: 'https://recruiter.naukri.com',
    available: true,
    supports_managed: true,
    env_key: 'NAUKRI_API_KEY',
  },
  {
    id: 'shine',
    name: 'Shine.com',
    logo: '✨',
    color: '#F7971E',
    description: 'TimesGroup\'s job portal — 30M+ candidates in India. Managed mode available via Quorbit account, or connect your own.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Recruiter ID',
    docs_url: 'https://www.shine.com/recruiter',
    available: true,
    supports_managed: true,
    env_key: 'SHINE_API_KEY',
  },
  {
    id: 'timesjobs',
    name: 'TimesJobs',
    logo: '🕐',
    color: '#E31E2D',
    description: 'Strong reach for mid-senior roles in India. Managed mode available, or use your own TimesJobs partner account.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Partner ID',
    docs_url: 'https://www.timesjobs.com/employer',
    available: true,
    supports_managed: true,
    env_key: 'TIMESJOBS_API_KEY',
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter',
    logo: '📮',
    color: '#4A90D9',
    description: 'Reach 12M+ job seekers globally. Managed mode available via Quorbit partner account.',
    connection_type: 'api_key',
    region: ['global'],
    key2_label: 'Partner ID',
    docs_url: 'https://www.ziprecruiter.com/partner',
    available: true,
    supports_managed: true,
    env_key: 'ZIPRECRUITER_API_KEY',
  },

  // ── Quick Post (no API, opens portal pre-filled) ───────────────
  {
    id: 'iimjobs',
    name: 'iimjobs',
    logo: '🎓',
    color: '#1B4F72',
    description: 'Premium management & senior roles platform. Opens pre-filled — no API available.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://www.iimjobs.com/recruiter/postjob.php?title={title}&location={location}',
    available: true,
    supports_managed: false,
  },
  {
    id: 'hirist',
    name: 'Hirist.tech',
    logo: '💻',
    color: '#6C47FF',
    description: 'Tech-focused board for developers and engineers in India.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://www.hirist.tech/employer/post-job?title={title}&location={location}',
    available: true,
    supports_managed: false,
  },
  {
    id: 'internshala',
    name: 'Internshala',
    logo: '🎯',
    color: '#009688',
    description: 'India\'s largest internship + fresher platform — 15M+ students.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://internshala.com/recruiter/job-post?title={title}&location={location}',
    available: true,
    supports_managed: false,
  },
  {
    id: 'apna',
    name: 'Apna.co',
    logo: '🤝',
    color: '#7C3AED',
    description: 'Blue/grey collar and SMB hiring — 50M+ workers across India.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://employer.apna.co/post-job?title={title}&location={location}',
    available: true,
    supports_managed: false,
  },
  {
    id: 'cutshort',
    name: 'Cutshort',
    logo: '✂️',
    color: '#E91E63',
    description: 'AI-powered hiring for tech startups — strong in Bangalore/Mumbai.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://cutshort.io/employer/jobs/add?title={title}&location={location}',
    available: true,
    supports_managed: false,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    logo: '🪟',
    color: '#0CAA41',
    description: 'Register our Indeed XML feed in Glassdoor Employer Center to auto-sync all jobs.',
    connection_type: 'feed',
    region: ['global'],
    feed_path: '/api/feeds/indeed',
    docs_url: 'https://help.glassdoor.com/s/article/Job-Feed-Integration',
    available: true,
    supports_managed: true,
  },
]

export function getIntegration(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find(i => i.id === id)
}

export function getIntegrationsByType(type: ConnectionType): IntegrationDef[] {
  return INTEGRATIONS.filter(i => i.connection_type === type)
}

export const QUICK_POST_PLATFORMS = INTEGRATIONS.filter(i => i.connection_type === 'quick')
export const API_PLATFORMS = INTEGRATIONS.filter(i => i.connection_type === 'api_key')
export const OAUTH_PLATFORMS = INTEGRATIONS.filter(i => i.connection_type === 'oauth')
export const FEED_PLATFORMS = INTEGRATIONS.filter(i => i.connection_type === 'feed')
