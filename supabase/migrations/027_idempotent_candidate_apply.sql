-- submit_candidate_application() (migration 026) already can't produce a
-- duplicate row - candidate_applications has a pre-existing
-- UNIQUE (candidate_id, job_id) constraint that backstops it regardless of
-- what the function does. But the function only checked exists() *before*
-- inserting, with no handling for the insert itself hitting that
-- constraint. Under true concurrency (two tabs, a network-level retry
-- firing while the first request is still in flight) both transactions can
-- pass the exists() check before either commits, so the loser hits an
-- unhandled unique_violation and the caller sees a raw 500 instead of the
-- same clean "duplicate" response a sequential double-click gets. This adds
-- an exception handler so both cases behave identically to the caller.
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

  begin
    insert into candidate_applications (candidate_id, job_id, company_id, match_score, status, applied_at)
      values (p_candidate_id, p_job_id, p_company_id, p_match_score, 'pending', now())
      returning id into v_application_id;
  exception when unique_violation then
    -- Lost a genuine concurrent race against another in-flight request for
    -- the same (candidate, job) pair. The other request's row already
    -- exists; report this one as a duplicate instead of raising a raw
    -- Postgres error up to the API layer.
    return query select null::uuid, true, false;
    return;
  end;

  select id into v_imported_id from imported_candidates
    where email = p_candidate_email and company_id = p_company_id;

  if v_imported_id is null then
    begin
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
    exception when unique_violation then
      -- Another concurrent request for the same candidate/company created
      -- this row first (e.g. applying to two jobs at the same company at
      -- once) - re-select it instead of failing the whole application.
      select id into v_imported_id from imported_candidates
        where email = p_candidate_email and company_id = p_company_id;
    end;
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
