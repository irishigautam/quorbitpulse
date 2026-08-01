-- Fixes two related issues in the candidate apply flow
-- (app/api/candidate/apply/route.ts):
--
-- 1. No transaction: the app previously did 4+ sequential, un-transacted
--    writes (insert candidate_applications -> upsert imported_candidates ->
--    upsert candidate_job_assignments -> update status). If a later step
--    threw, the candidate had a "successful" application that never showed
--    up in the recruiter's pipeline, with no rollback.
-- 2. Job-deleted-mid-application race: the job's active status was checked
--    once at the top of the handler, then not re-checked before the final
--    insert - a recruiter closing/deleting the job in that window let an
--    application attach to a dead job.
--
-- This function performs the job-status re-check (with a row lock) and all
-- four writes as a single atomic transaction. Scoring itself stays in the
-- application layer (lib/scoring/engine.ts) - this function just persists
-- the result the caller already computed.
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history. See app/api/candidate/apply/route.ts for the caller.

create or replace function public.submit_candidate_application(
  p_candidate_id uuid,
  p_job_id uuid,
  p_company_id uuid,
  p_match_score int,
  p_score_breakdown jsonb,
  p_candidate_email text,
  p_candidate_full_name text,
  p_candidate_current_title text,
  p_candidate_current_company text,
  p_candidate_location text,
  p_candidate_linkedin_url text,
  p_candidate_skills text[],
  p_candidate_domain text[],
  p_candidate_seniority text,
  p_candidate_years_experience numeric,
  p_candidate_resume_file_path text
)
returns table(application_id uuid, duplicate boolean, job_inactive boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_status text;
  v_application_id uuid;
  v_imported_id uuid;
begin
  -- Row-lock the job for the duration of this transaction so a concurrent
  -- close/delete can't slip in between this check and the writes below.
  select status into v_job_status from jobs where id = p_job_id for update;

  if v_job_status is null or v_job_status <> 'active' then
    return query select null::uuid, false, true;
    return;
  end if;

  if exists (
    select 1 from candidate_applications
    where candidate_id = p_candidate_id and job_id = p_job_id
  ) then
    return query select null::uuid, true, false;
    return;
  end if;

  insert into candidate_applications (candidate_id, job_id, company_id, match_score, status, applied_at)
    values (p_candidate_id, p_job_id, p_company_id, p_match_score, 'pending', now())
    returning id into v_application_id;

  select id into v_imported_id from imported_candidates
    where email = p_candidate_email and company_id = p_company_id;

  if v_imported_id is null then
    insert into imported_candidates (
      company_id, full_name, email, current_title, current_company, location, linkedin_url,
      import_source, skills, domain, seniority, years_experience, resume_file_path,
      status, fingerprint_status
    ) values (
      p_company_id, p_candidate_full_name, p_candidate_email, p_candidate_current_title,
      p_candidate_current_company, p_candidate_location, p_candidate_linkedin_url, 'direct_apply',
      coalesce(p_candidate_skills, array[]::text[]), coalesce(p_candidate_domain, array[]::text[]),
      p_candidate_seniority, p_candidate_years_experience, p_candidate_resume_file_path,
      'new', 'done'
    )
    returning id into v_imported_id;
  elsif p_candidate_resume_file_path is not null then
    update imported_candidates set resume_file_path = p_candidate_resume_file_path where id = v_imported_id;
  end if;

  insert into candidate_job_assignments (
    candidate_id, job_id, company_id, pipeline_stage, match_score, score_breakdown, scored_at, tags
  ) values (
    v_imported_id, p_job_id, p_company_id, 'sourced', p_match_score, p_score_breakdown, now(), array['direct-apply']
  )
  on conflict (candidate_id, job_id) do update
    set match_score = excluded.match_score,
        score_breakdown = excluded.score_breakdown,
        scored_at = excluded.scored_at;

  update imported_candidates set match_score = p_match_score, status = 'scored' where id = v_imported_id;

  return query select v_application_id, false, false;
end;
$$;

revoke all on function public.submit_candidate_application(
  uuid, uuid, uuid, int, jsonb, text, text, text, text, text, text, text[], text[], text, numeric, text
) from public, anon, authenticated;
grant execute on function public.submit_candidate_application(
  uuid, uuid, uuid, int, jsonb, text, text, text, text, text, text, text[], text[], text, numeric, text
) to service_role;
