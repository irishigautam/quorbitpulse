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

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) return NextResponse.json({
    error: error.message,
    errorCode: (error as any).code,
    errorStatus: (error as any).status,
    hasServiceKey,
    supabaseUrl,
  }, { status: 500 })
  return NextResponse.json({ ok: true, email: data.user?.email })
}
