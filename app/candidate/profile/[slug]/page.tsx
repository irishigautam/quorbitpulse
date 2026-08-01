/**
 * Legacy redirect: /candidate/profile/[slug] → /candidate/[slug]
 */
import { redirect } from 'next/navigation'

export default async function LegacyCandidateProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/candidate/${slug}`)
}
