/**
 * Admin access allowlist.
 *
 * app/admin/page.tsx was previously reachable only via a raw X-Admin-Secret
 * header (curl/Postman only, by design — see its own comment on why the
 * ?secret= query-param path was removed). That's fine for automation but
 * means there was no way to actually browse the admin view after a normal
 * login. This adds a second, additive path: if the person hitting /admin
 * already has a normal Supabase Auth session (the same one used for
 * company/candidate login) and their email is on this allowlist, they get
 * in without needing a header at all. The header path is untouched.
 */

const DEFAULT_ADMIN_EMAILS = ['rishi@thequorbit.com']

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS
  if (!fromEnv) return DEFAULT_ADMIN_EMAILS
  return fromEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}
