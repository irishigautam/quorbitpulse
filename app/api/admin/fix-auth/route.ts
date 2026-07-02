import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// One-time route: properly update a user's password via gotrue Admin API
// DELETE THIS FILE after login is working
export async function POST(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId, password } = await req.json()
  if (!userId || !password) {
    return NextResponse.json({ error: 'userId and password required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, email: data.user?.email })
}
