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
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jobpulse.quorbit.in'

export const INTEGRATIONS: IntegrationDef[] = [
  // ── Auto-active (no setup needed) ──────────────────────────────
  {
    id: 'google',
    name: 'Google Jobs',
    logo: '🔍',
    color: '#4285F4',
    description: 'Jobs appear in Google Search results automatically via structured data (schema.org). No setup needed.',
    connection_type: 'feed',
    region: ['global'],
    feed_path: '/jobs',
    available: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    logo: '🔵',
    color: '#003A9B',
    description: 'Register our XML feed once in Indeed Employer Portal. SimplyHired, Jora, and Glassdoor also ingest this feed.',
    connection_type: 'feed',
    region: ['global', 'india'],
    feed_path: '/api/feeds/indeed',
    docs_url: 'https://employers.indeed.com/p/post-jobs/xml-feed',
    available: true,
  },

  // ── OAuth integrations ─────────────────────────────────────────
  {
    id: 'linkedin',
    name: 'LinkedIn',
    logo: '💼',
    color: '#0A66C2',
    description: 'Post jobs to your LinkedIn Company Page automatically. Reaches 900M+ professionals worldwide.',
    connection_type: 'oauth',
    region: ['global', 'india'],
    docs_url: 'https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api',
    available: true,
  },
  {
    id: 'wellfound',
    name: 'Wellfound (AngelList)',
    logo: '🚀',
    color: '#000000',
    description: 'Post to Wellfound (formerly AngelList Talent) — the go-to platform for startup jobs.',
    connection_type: 'oauth',
    region: ['global', 'india'],
    docs_url: 'https://wellfound.com/talent/developer-docs',
    available: true,
  },

  // ── API Key integrations ───────────────────────────────────────
  {
    id: 'naukri',
    name: 'Naukri.com',
    logo: '🟠',
    color: '#FF7555',
    description: 'India\'s largest job portal with 70M+ registered candidates. Requires Naukri RMS API access.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Client ID',
    docs_url: 'https://recruiter.naukri.com',
    available: true,
  },
  {
    id: 'shine',
    name: 'Shine.com',
    logo: '✨',
    color: '#F7971E',
    description: 'TimesGroup\'s job portal — 30M+ registered candidates across India. API Key from your Shine recruiter account.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Recruiter ID',
    docs_url: 'https://www.shine.com/recruiter',
    available: true,
  },
  {
    id: 'timesjobs',
    name: 'TimesJobs',
    logo: '🕐',
    color: '#E31E2D',
    description: 'Another TimesGroup property — strong reach for mid-senior level roles in India.',
    connection_type: 'api_key',
    region: ['india'],
    key2_label: 'Partner ID',
    docs_url: 'https://www.timesjobs.com/employer',
    available: true,
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter',
    logo: '📮',
    color: '#4A90D9',
    description: 'Post to ZipRecruiter and reach 12M+ active job seekers. Strong for US/global roles.',
    connection_type: 'api_key',
    region: ['global'],
    key2_label: 'Partner ID',
    docs_url: 'https://www.ziprecruiter.com/partner',
    available: true,
  },

  // ── Quick Post (no API, opens portal pre-filled) ───────────────
  {
    id: 'iimjobs',
    name: 'iimjobs',
    logo: '🎓',
    color: '#1B4F72',
    description: 'Premium platform for management, consulting, and senior roles. Opens iimjobs with your job details pre-filled.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://www.iimjobs.com/recruiter/postjob.php?title={title}&location={location}',
    available: true,
  },
  {
    id: 'hirist',
    name: 'Hirist.tech',
    logo: '💻',
    color: '#6C47FF',
    description: 'Tech-focused job board for developers, engineers, and data roles in India.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://www.hirist.tech/employer/post-job?title={title}&location={location}',
    available: true,
  },
  {
    id: 'internshala',
    name: 'Internshala',
    logo: '🎯',
    color: '#009688',
    description: 'India\'s largest internship + fresher job platform. 15M+ students registered.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://internshala.com/recruiter/job-post?title={title}&location={location}',
    available: true,
  },
  {
    id: 'apna',
    name: 'Apna.co',
    logo: '🤝',
    color: '#7C3AED',
    description: 'Blue/grey collar and SMB hiring platform with 50M+ workers across India.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://employer.apna.co/post-job?title={title}&location={location}',
    available: true,
  },
  {
    id: 'cutshort',
    name: 'Cutshort',
    logo: '✂️',
    color: '#E91E63',
    description: 'AI-powered hiring platform for tech startups. Strong candidate quality, especially in Bangalore/Mumbai.',
    connection_type: 'quick',
    region: ['india'],
    quick_url: 'https://cutshort.io/employer/jobs/add?title={title}&location={location}',
    available: true,
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
