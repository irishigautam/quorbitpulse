import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendExpiryReminderEmail } from '@/lib/emails'

export const runtime = 'nodejs'

// This runs daily via Vercel Cron (configured in vercel.json)
// Sends expiry reminders for jobs expiring in 7 days

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Jobs expiring in 7 days (within a 1-hour window to avoid duplicate sends)
  const in7Days = new Date()
  in7Days.setDate(in7Days.getDate() + 7)

  const windowStart = new Date(in7Days)
  windowStart.setHours(0, 0, 0, 0)
  const windowEnd = new Date(in7Days)
  windowEnd.setHours(23, 59, 59, 999)

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*, company:companies(*)')
    .eq('status', 'active')
    .gte('expires_at', windowStart.toISOString())
    .lte('expires_at', windowEnd.toISOString())

  if (error) {
    console.error('[cron/expiry-reminders]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  for (const job of jobs ?? []) {
    try {
      await sendExpiryReminderEmail(job.company, job)
      sent++
    } catch (err) {
      console.error(`[cron/expiry-reminders] Failed for job ${job.id}:`, err)
    }
  }

  return NextResponse.json({ success: true, sent, total: jobs?.length ?? 0 })
}
