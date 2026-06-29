import { NextRequest, NextResponse } from 'next/server'

export const DOMAINS = [
  'Salesforce',
  'Frontend',
  'Backend',
  'Fullstack',
  'Data & ML',
  'DevOps',
  'Product',
  'Design',
  'Marketing',
  'Sales',
  'Mobile',
  'Security',
] as const

export type Domain = typeof DOMAINS[number]

export type SeniorityLevel = 'entry' | 'mid' | 'senior' | 'manager' | 'director' | 'executive'

export const SENIORITY_LEVELS: SeniorityLevel[] = [
  'entry', 'mid', 'senior', 'manager', 'director', 'executive',
]

// Keywords in title that signal a seniority level
const TITLE_SENIORITY_KEYWORDS: Record<SeniorityLevel, string[]> = {
  entry: ['intern', 'trainee', 'junior', 'associate', 'graduate', 'fresher', 'jr.', 'entry level'],
  mid: ['analyst', 'specialist', 'coordinator', 'officer', 'executive'], // 'executive' in Indian context = mid-level
  senior: ['senior', 'sr.', 'lead', 'staff', 'principal', 'expert', 'architect'],
  manager: ['manager', 'team lead', 'team leader'],
  director: ['director', 'vp ', 'avp', 'vice president', 'head of', 'group head'],
  executive: ['cmo', 'cto', 'ceo', 'coo', 'cfo', 'chief ', 'founder', 'president', 'managing director'],
}

// YOE ranges that map to seniority levels
const YOE_TO_LEVEL: Array<{ min: number; max: number; level: SeniorityLevel }> = [
  { min: 0, max: 2, level: 'entry' },
  { min: 3, max: 5, level: 'mid' },
  { min: 6, max: 8, level: 'senior' },
  { min: 5, max: 10, level: 'manager' },  // manager can overlap senior
  { min: 9, max: 14, level: 'director' },
  { min: 15, max: 99, level: 'executive' },
]

// Keywords for domain detection
const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  Salesforce: [
    'salesforce', 'apex', 'visualforce', 'soql', 'lightning web component', 'lwc',
    'cpq', 'pardot', 'marketing cloud', 'mulesoft', 'trailhead', 'sfdc', 'force.com',
    'salesforce admin', 'salesforce developer', 'salesforce architect',
  ],
  Frontend: [
    'frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'svelte',
    'next.js', 'nuxt', 'html', 'css', 'javascript', 'typescript', 'webpack',
    'vite', 'tailwind', 'redux', 'ui developer', 'web developer',
  ],
  Backend: [
    'backend', 'back-end', 'back end', 'node.js', 'express', 'django', 'fastapi',
    'flask', 'spring boot', 'golang', 'go developer', 'java developer',
    'rust', 'grpc', 'microservices', 'rest api', 'graphql', 'api developer',
  ],
  Fullstack: ['fullstack', 'full-stack', 'full stack', 'mern', 'mean', 'lamp'],
  'Data & ML': [
    'machine learning', 'deep learning', 'ml engineer', 'ai engineer', 'data scientist',
    'data engineer', 'data analyst', 'tensorflow', 'pytorch', 'pandas', 'numpy',
    'apache spark', 'dbt', 'tableau', 'power bi', 'llm', 'nlp', 'computer vision',
    'analytics engineer', 'business analyst', 'etl', 'airflow', 'mlops',
  ],
  DevOps: [
    'devops', 'site reliability', 'sre', 'platform engineer', 'cloud engineer',
    'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd',
    'aws', 'azure', 'gcp', 'linux', 'infrastructure',
  ],
  Product: [
    'product manager', 'product management', 'product owner', 'product lead',
    'agile', 'scrum master', 'roadmap', 'product strategy', 'product analyst', 'growth product',
  ],
  Design: [
    'ux designer', 'ui designer', 'product designer', 'visual designer',
    'figma', 'sketch', 'adobe xd', 'prototyping', 'wireframe', 'user research',
    'design system', 'interaction design', 'motion design',
  ],
  Marketing: [
    'marketing', 'seo', 'sem', 'content marketing', 'growth marketing',
    'digital marketing', 'social media', 'email marketing', 'paid ads',
    'performance marketing', 'brand', 'demand generation',
  ],
  Sales: [
    'sales', 'account executive', 'account manager', 'business development',
    'revenue', 'cold outreach', 'pipeline', 'b2b sales', 'inside sales',
    'sales development', 'sdr', 'bdr',
  ],
  Mobile: [
    'mobile developer', 'ios developer', 'android developer', 'react native',
    'flutter', 'swift', 'kotlin', 'xcode', 'mobile engineer',
  ],
  Security: [
    'security engineer', 'cybersecurity', 'penetration testing', 'pentest',
    'soc analyst', 'appsec', 'devsecops', 'vulnerability', 'infosec',
    'cloud security', 'identity', 'zero trust',
  ],
}

// Domain-specific skills at each seniority level
export const DOMAIN_SKILLS_BY_LEVEL: Record<Domain, Record<SeniorityLevel, string[]>> = {
  Marketing: {
    entry: ['Social Media', 'Content Writing', 'Basic SEO', 'Canva', 'Email Campaigns'],
    mid: ['Campaign Management', 'Google Analytics', 'A/B Testing', 'Marketing Automation', 'HubSpot'],
    senior: ['Growth Strategy', 'Attribution Modeling', 'Revenue Marketing', 'Paid Ads', 'SEO'],
    manager: ['Agency Management', 'Marketing Budget', 'OKR Setting', 'Content Strategy'],
    director: ['Brand Strategy', 'GTM Strategy', 'Alliances & Partnerships', 'Revenue Ownership', 'P&L'],
    executive: ['Corporate Communications', 'M&A Brand Integration', 'Investor Relations', 'Board Reporting'],
  },
  Frontend: {
    entry: ['HTML', 'CSS', 'JavaScript', 'React basics', 'Git'],
    mid: ['React', 'TypeScript', 'REST APIs', 'Testing (Jest)', 'Webpack'],
    senior: ['Next.js', 'Performance Optimization', 'Design Systems', 'Frontend Architecture'],
    manager: ['Code Review Culture', 'Eng Hiring', 'Sprint Planning', 'Technical Roadmap'],
    director: ['Frontend Platform Strategy', 'Cross-org Alignment', 'Build vs Buy Decisions'],
    executive: ['Engineering Vision', 'Tech Org Design', 'Board Engineering Updates'],
  },
  Backend: {
    entry: ['Python', 'SQL', 'REST APIs', 'Git', 'Linux basics'],
    mid: ['Node.js', 'PostgreSQL', 'Redis', 'Docker', 'API Design'],
    senior: ['Microservices', 'System Design', 'Performance Tuning', 'Database Optimization'],
    manager: ['Backend Eng Hiring', 'Incident Management', 'On-call Culture', 'Sprint Planning'],
    director: ['Platform Architecture', 'Reliability Engineering', 'Cost Optimization', 'Vendor Decisions'],
    executive: ['Engineering Org Strategy', 'Technical Due Diligence', 'CTO-level Reporting'],
  },
  Fullstack: {
    entry: ['React', 'Node.js', 'SQL', 'Git', 'REST APIs basics'],
    mid: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Docker'],
    senior: ['System Design', 'Next.js', 'GraphQL', 'AWS', 'Performance Optimization'],
    manager: ['Fullstack Team Hiring', 'Monorepo Management', 'Technical Roadmap'],
    director: ['Platform Architecture', 'Engineering OKRs', 'Org Scaling'],
    executive: ['CTO Track', 'Engineering Vision', 'Tech M&A'],
  },
  'Data & ML': {
    entry: ['Python', 'SQL', 'Pandas', 'Basic Statistics', 'Excel'],
    mid: ['Machine Learning', 'TensorFlow/PyTorch', 'dbt', 'Airflow', 'Tableau'],
    senior: ['MLOps', 'Feature Engineering', 'Model Governance', 'Distributed Systems'],
    manager: ['Data Team Hiring', 'Data Contracts', 'ML Platform', 'Stakeholder Analytics'],
    director: ['Data Strategy', 'AI Roadmap', 'Data Monetization', 'AI Compliance'],
    executive: ['Chief AI Officer Track', 'AI Ethics', 'AI Investment Thesis'],
  },
  DevOps: {
    entry: ['Linux', 'Bash Scripting', 'Git', 'Docker basics', 'CI/CD basics'],
    mid: ['Kubernetes', 'Terraform', 'AWS', 'Prometheus', 'Jenkins'],
    senior: ['Platform Engineering', 'SRE Practices', 'FinOps', 'Multi-cloud Strategy'],
    manager: ['SRE Team Mgmt', 'Incident Commander', 'On-call Optimization', 'Eng Productivity'],
    director: ['Cloud Architecture', 'SLA Ownership', 'Vendor Negotiation', 'CapEx Planning'],
    executive: ['Infrastructure Vision', 'Cloud Cost at Scale', 'Security Posture'],
  },
  Product: {
    entry: ['Jira', 'User Stories', 'Basic Analytics', 'Wireframing', 'Stakeholder Comms'],
    mid: ['Roadmapping', 'A/B Testing', 'SQL', 'Agile', 'User Research'],
    senior: ['Product Strategy', 'Pricing & Packaging', 'Growth Product', 'OKRs'],
    manager: ['PM Team Hiring', 'Prioritization Frameworks', 'Exec Alignment', 'Portfolio Mgmt'],
    director: ['Product Vision', 'P&L Ownership', 'Go-to-Market', 'Board Product Updates'],
    executive: ['Company Vision', 'Market Expansion', 'M&A Integration', 'IPO Narrative'],
  },
  Design: {
    entry: ['Figma', 'Wireframing', 'Visual Design', 'UI basics', 'Prototyping'],
    mid: ['User Research', 'Usability Testing', 'Design Systems', 'Interaction Design'],
    senior: ['Design System Leadership', 'Cross-functional Design', 'Accessibility', 'Design Ops'],
    manager: ['Design Team Hiring', 'Design Critique Culture', 'Design Sprints', 'Brand Consistency'],
    director: ['Design Strategy', 'UX Org Building', 'Executive Design Vision', 'Brand & Identity'],
    executive: ['Chief Design Officer Track', 'Design-led Culture', 'M&A Design Integration'],
  },
  Sales: {
    entry: ['Cold Calling', 'CRM basics', 'Prospecting', 'Email Outreach', 'Active Listening'],
    mid: ['Pipeline Management', 'B2B Sales', 'Negotiation', 'Demo Skills', 'HubSpot'],
    senior: ['Enterprise Sales', 'Solution Selling', 'Multi-stakeholder Deals', 'Contract Negotiation'],
    manager: ['Sales Team Hiring', 'Quota Setting', 'Sales Coaching', 'Revenue Forecasting'],
    director: ['Sales Strategy', 'Channel Partnerships', 'Revenue Ownership', 'Sales Enablement'],
    executive: ['CEO Sales Motion', 'Revenue Board Reporting', 'M&A GTM Integration'],
  },
  Mobile: {
    entry: ['Swift/Kotlin basics', 'Xcode/Android Studio', 'Git', 'REST APIs', 'UI basics'],
    mid: ['iOS/Android Development', 'React Native', 'Flutter', 'Push Notifications', 'App Store'],
    senior: ['Mobile Architecture', 'Performance Optimization', 'CI/CD for Mobile', 'Cross-platform'],
    manager: ['Mobile Team Hiring', 'Release Management', 'App Quality Culture'],
    director: ['Mobile Platform Strategy', 'SDK Ecosystem', 'App Revenue Strategy'],
    executive: ['Mobile Vision', 'Cross-platform Standards', 'Mobile M&A'],
  },
  Security: {
    entry: ['Networking basics', 'Linux', 'OWASP Top 10', 'Security fundamentals'],
    mid: ['Penetration Testing', 'SIEM', 'Cloud Security basics', 'Vulnerability Scanning'],
    senior: ['AppSec', 'Zero Trust Architecture', 'Threat Modeling', 'DevSecOps'],
    manager: ['Security Team Hiring', 'Incident Response', 'Security Awareness Programs'],
    director: ['Security Strategy', 'Compliance (SOC2, ISO)', 'Risk Management', 'Board Security Reporting'],
    executive: ['CISO Track', 'Cyber Insurance', 'M&A Security Due Diligence'],
  },
}

// Cross-role skills that appear at each seniority level (not domain-specific)
export const SENIORITY_SKILLS: Record<SeniorityLevel, string[]> = {
  entry: ['Communication', 'Attention to Detail', 'Time Management'],
  mid: ['Cross-functional Collaboration', 'Data-driven Decisions', 'Project Management'],
  senior: ['Technical Leadership', 'Mentoring & Coaching', 'Strategic Thinking'],
  manager: ['Team Management', 'Performance Reviews', 'Hiring & Interviewing', 'Budget Management'],
  director: ['P&L Ownership', 'Executive Stakeholder Management', 'Org Building', 'Strategic Alliances'],
  executive: ['Board Communication', 'M&A Strategy', 'Company Vision', 'Fundraising'],
}

function detectSeniority(title: string, minExperience: number): SeniorityLevel {
  const t = title.toLowerCase()

  // Detect from title keywords — take highest level found
  let titleLevel: SeniorityLevel | null = null
  for (const level of [...SENIORITY_LEVELS].reverse()) {
    if (TITLE_SENIORITY_KEYWORDS[level].some(k => t.includes(k))) {
      titleLevel = level
      break
    }
  }

  // Detect from YOE — prefer director/executive boundary using explicit thresholds
  let yoeLevel: SeniorityLevel = 'mid'
  if (minExperience <= 2) yoeLevel = 'entry'
  else if (minExperience <= 5) yoeLevel = 'mid'
  else if (minExperience <= 8) yoeLevel = 'senior'
  else if (minExperience <= 11) yoeLevel = 'manager'
  else if (minExperience <= 15) yoeLevel = 'director'
  else yoeLevel = 'executive'

  if (!titleLevel) return yoeLevel

  // Conflict resolution: if they differ by ≥2 levels, take the higher
  const tIdx = SENIORITY_LEVELS.indexOf(titleLevel)
  const yIdx = SENIORITY_LEVELS.indexOf(yoeLevel)
  if (Math.abs(tIdx - yIdx) >= 2) {
    return SENIORITY_LEVELS[Math.max(tIdx, yIdx)]
  }

  // Otherwise title wins (intentional job design)
  return titleLevel
}

function domainScore(haystack: string, keywords: string[]): number {
  return keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0)
}

export async function POST(req: NextRequest) {
  const { title = '', description = '', domain = '', minExperience = 0 } = await req.json()

  // Detect domain from title + description if not provided
  let resolvedDomain = domain as Domain | ''
  if (!resolvedDomain) {
    // Title weighted 3x
    const haystack = `${title.toLowerCase()} ${title.toLowerCase()} ${title.toLowerCase()} ${description.toLowerCase().replace(/<[^>]*>/g, ' ')}`
    const scores = DOMAINS.map(d => ({ domain: d, score: domainScore(haystack, DOMAIN_KEYWORDS[d]) }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
    if (scores.length > 0) resolvedDomain = scores[0].domain
  }

  // Detect seniority
  const level = detectSeniority(title, minExperience)

  // Build 3-layer skill list, capped at 14 total
  const domainSkills: string[] = resolvedDomain
    ? (DOMAIN_SKILLS_BY_LEVEL[resolvedDomain]?.[level] ?? [])
    : []
  const senioritySkills: string[] = SENIORITY_SKILLS[level] ?? []

  // Deduplicate and cap
  const seen = new Set<string>()
  const combined: Array<{ skill: string; layer: 'domain' | 'seniority' }> = []

  for (const s of domainSkills) {
    if (!seen.has(s) && combined.length < 14) { seen.add(s); combined.push({ skill: s, layer: 'domain' }) }
  }
  for (const s of senioritySkills) {
    if (!seen.has(s) && combined.length < 14) { seen.add(s); combined.push({ skill: s, layer: 'seniority' }) }
  }

  return NextResponse.json({
    domains: resolvedDomain ? [resolvedDomain] : [],
    level,
    suggestedSkills: combined.map(c => c.skill),
    skillLayers: {
      domain: combined.filter(c => c.layer === 'domain').map(c => c.skill),
      seniority: combined.filter(c => c.layer === 'seniority').map(c => c.skill),
    },
  })
}
