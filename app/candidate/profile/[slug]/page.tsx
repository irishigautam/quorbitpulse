/**
 * Legacy redirect: /candidate/profile/[slug] → /candidate/[slug]
 */
import { redirect } from 'next/navigation'

export default function LegacyCandidateProfile({ params }: { params: { slug: string } }) {
  redirect(`/candidate/${params.slug}`)
}
