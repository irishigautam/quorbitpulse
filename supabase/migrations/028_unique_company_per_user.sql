-- Retry-safety audit finding: "Create Company" had no DB-level guarantee of
-- one company per founding user. Both app/onboarding/signup/page.tsx and
-- app/onboarding/post-confirm/page.tsx only guarded against duplicates with
-- a client-side check-then-insert (select ... eq('user_id', ...) then
-- insert()) - a real TOCTOU race (two tabs, a retried request) could create
-- two companies rows for the same user_id. requireCompany() and every other
-- read path already assume exactly one company per user_id, so this is
-- enforcing an invariant the app already depends on, not introducing a new
-- one. Verified no existing duplicate (user_id) rows before adding this.
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history.

alter table public.companies
  add constraint companies_user_id_key unique (user_id);
