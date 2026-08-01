/**
 * Edit an existing job. Previously there was no way to fix a typo or update
 * a posted job's details short of expiring it and starting over.
 */

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditJobClient from './EditJobClient'

export const dynamic = 'force-dynamic'

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { company } = await requireRole('recruiter')
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('company_id', company.id)
    .single()

  if (!job) notFound()

  return <EditJobClient job={job} />
}
