-- Private storage bucket for candidate resume files. EJ-04 (launch checklist)
-- requires a recruiter to be able to open a candidate's resume without a
-- broken link -- previously the raw PDF was parsed in-memory and discarded,
-- so there was nothing to open. Bucket is private; access is only ever via
-- short-lived signed URLs generated server-side (service role), never a
-- public URL.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

alter table candidate_profiles
  add column if not exists resume_file_path text;

alter table imported_candidates
  add column if not exists resume_file_path text;
