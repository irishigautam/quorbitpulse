/**
 * inf2 — HRMS partner integrations.
 * Adapters for Zoho Recruit, Keka, and greytHR.
 * Each adapter normalises their webhook format into Quorbit's pipeline event shape.
 *
 * Usage pattern: HRMS fires a webhook → Quorbit /api/hrms/[partner]/webhook receives it
 * → adapter normalises → we update candidate pipeline stage.
 */

export type HrmsPartner = 'zoho_recruit' | 'keka' | 'greythr'

export interface NormalisedHrmsEvent {
  partner: HrmsPartner
  event_type: 'candidate_hired' | 'candidate_rejected' | 'stage_change' | 'new_candidate'
  external_candidate_id: string
  external_job_id: string | null
  candidate_name: string | null
  candidate_email: string | null
  stage: string | null
  raw: Record<string, unknown>
}

// ---- Zoho Recruit ----
export function normaliseZohoRecruitEvent(payload: Record<string, unknown>): NormalisedHrmsEvent {
  const data = (payload.data as any) ?? payload
  const status = String(data.Current_Stage ?? data.Candidate_Status ?? '').toLowerCase()

  const event_type =
    status.includes('hired') || status.includes('offer accepted') ? 'candidate_hired' :
    status.includes('rejected') || status.includes('disqualified')  ? 'candidate_rejected' :
    status.includes('new')                                          ? 'new_candidate'
    : 'stage_change'

  return {
    partner: 'zoho_recruit',
    event_type,
    external_candidate_id: String(data.Candidate_Id ?? data.id ?? ''),
    external_job_id:       String(data.Job_Opening_Id ?? '') || null,
    candidate_name:        data.Candidate_Name ?? null,
    candidate_email:       data.Email ?? null,
    stage:                 data.Current_Stage ?? null,
    raw: payload,
  }
}

// ---- Keka ----
export function normaliseKekaEvent(payload: Record<string, unknown>): NormalisedHrmsEvent {
  const event = String(payload.eventType ?? '').toLowerCase()
  const data = (payload.data as any) ?? {}
  const candidate = data.candidate ?? {}

  const event_type =
    event.includes('hired')    ? 'candidate_hired'   :
    event.includes('rejected') ? 'candidate_rejected' :
    event.includes('new')      ? 'new_candidate'
    : 'stage_change'

  return {
    partner: 'keka',
    event_type,
    external_candidate_id: String(candidate.id ?? data.candidateId ?? ''),
    external_job_id:       String(data.jobId ?? '') || null,
    candidate_name:        `${candidate.firstName ?? ''} ${candidate.lastName ?? ''}`.trim() || null,
    candidate_email:       candidate.email ?? null,
    stage:                 data.stage ?? data.currentStage ?? null,
    raw: payload,
  }
}

// ---- greytHR ----
export function normaliseGreythrEvent(payload: Record<string, unknown>): NormalisedHrmsEvent {
  const data = (payload.eventData as any) ?? payload
  const status = String(data.status ?? data.hiringStage ?? '').toLowerCase()

  const event_type =
    status.includes('join')   || status.includes('hired')    ? 'candidate_hired'   :
    status.includes('reject') || status.includes('withdrawn') ? 'candidate_rejected' :
    'stage_change'

  return {
    partner: 'greythr',
    event_type,
    external_candidate_id: String(data.candidateId ?? data.applicantId ?? ''),
    external_job_id:       String(data.requisitionId ?? '') || null,
    candidate_name:        data.candidateName ?? null,
    candidate_email:       data.email ?? null,
    stage:                 data.hiringStage ?? data.status ?? null,
    raw: payload,
  }
}

export function normalise(partner: HrmsPartner, payload: Record<string, unknown>): NormalisedHrmsEvent {
  switch (partner) {
    case 'zoho_recruit': return normaliseZohoRecruitEvent(payload)
    case 'keka':         return normaliseKekaEvent(payload)
    case 'greythr':      return normaliseGreythrEvent(payload)
  }
}
