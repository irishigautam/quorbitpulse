/**
 * Blended score — lc6
 *
 * Combines passive fingerprint score and active chat readiness:
 *   blended = round(match_score * 0.70 + readiness_score * 0.30)
 *
 * Rules:
 * - If only match_score available: blended = match_score (no chat yet)
 * - If only readiness_score available: blended = readiness_score (rare edge case)
 * - If both available: weighted blend
 * - If neither: null
 */

export const BLEND_WEIGHTS = {
  fingerprint: 0.70,
  chat: 0.30,
} as const

export function computeBlendedScore(
  matchScore: number | null,
  readinessScore: number | null,
): number | null {
  if (matchScore === null && readinessScore === null) return null
  if (matchScore !== null && readinessScore === null) return matchScore
  if (matchScore === null && readinessScore !== null) return readinessScore
  return Math.round(matchScore! * BLEND_WEIGHTS.fingerprint + readinessScore! * BLEND_WEIGHTS.chat)
}
