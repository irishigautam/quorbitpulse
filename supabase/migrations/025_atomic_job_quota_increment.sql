-- Fixes a check-then-act race on job publish quota: the app previously did
-- `if (company.jobs_used >= company.jobs_quota)` in JS, then a separate
-- `UPDATE companies SET jobs_used = <stale value> + 1` a few lines later.
-- Two concurrent publish requests reading the same jobs_used both pass the
-- check and both increment from the same stale value, letting quota be
-- exceeded under concurrency. This function performs the check-and-increment
-- as a single atomic statement so Postgres's own row-level locking prevents
-- the race, instead of relying on the application to serialize requests.
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history. See app/api/jobs/[id]/publish/route.ts for the caller.

create or replace function public.try_increment_job_quota(p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update companies
    set jobs_used = jobs_used + 1
    where id = p_company_id
      and jobs_used < jobs_quota;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- Compensating action if the job publish itself fails after quota was
-- already reserved by try_increment_job_quota above.
create or replace function public.decrement_job_quota(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update companies
    set jobs_used = greatest(0, jobs_used - 1)
    where id = p_company_id;
end;
$$;

revoke all on function public.try_increment_job_quota(uuid) from public, anon, authenticated;
revoke all on function public.decrement_job_quota(uuid) from public, anon, authenticated;
grant execute on function public.try_increment_job_quota(uuid) to service_role;
grant execute on function public.decrement_job_quota(uuid) to service_role;
