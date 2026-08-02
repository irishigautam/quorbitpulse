-- Retry-safety audit finding: "Send Invite" (app/api/team/invite/route.ts)
-- had a safe, deduped DB write (upsert onConflict company_id,email) but an
-- unconditional email send after it - a retried request (network timeout,
-- accidental double-submit) resent the invite email every time, even though
-- the underlying invite row was correctly deduped. This adds a timestamp so
-- the route can debounce resends: skip the email if one was already sent in
-- the last 30 seconds (almost certainly a retry, not a deliberate re-invite),
-- but still allow a genuine later re-invite (e.g. after the original expired).
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history.

alter table public.company_invites add column if not exists last_sent_at timestamptz;
