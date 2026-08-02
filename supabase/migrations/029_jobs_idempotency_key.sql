-- Retry-safety audit finding: "Create Job" (app/api/jobs/create/route.ts) was
-- a bare insert with no idempotency protection - a lost response followed by
-- a client/network retry created a second, fully duplicate job row (and, for
-- non-draft jobs, double-incremented jobs_used and double-fired distribution/
-- email side effects). This adds an idempotency key the client generates once
-- per submission action; a partial unique index lets a retry with the same
-- key be detected and treated as "already done" instead of creating a
-- duplicate. NULL keys (older clients, or intentionally distinct
-- resubmissions) are unrestricted - the uniqueness only applies when a key
-- is actually supplied.
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history. See app/api/jobs/create/route.ts and
-- app/dashboard/post/page.tsx for the callers.

alter table public.jobs add column if not exists idempotency_key text;

create unique index if not exists jobs_company_idempotency_key_idx
  on public.jobs (company_id, idempotency_key)
  where idempotency_key is not null;
