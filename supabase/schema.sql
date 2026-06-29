-- ============================================================
-- JobPulse V1 — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Companies table
create table companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  website text not null,
  logo_url text,
  careers_email text,
  description text,
  verified boolean default false,
  plan_active boolean default false,
  plan_expires_at timestamptz,
  jobs_quota integer default 30,
  jobs_used integer default 0,
  razorpay_subscription_id text,
  created_at timestamptz default now()
);

-- Jobs table
create table jobs (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  description text not null,
  location text not null,
  job_type text check (job_type in
    ('full_time','part_time','contract','internship','freelance')),
  remote boolean default false,
  salary_min integer,
  salary_max integer,
  salary_currency text default 'INR',
  skills text[] default '{}',
  apply_url text,
  apply_email text,
  status text default 'active'
    check (status in ('active','expired','draft')),
  views integer default 0,
  posted_at timestamptz default now(),
  expires_at timestamptz default now() + interval '60 days',
  google_indexed boolean default false
);

-- API keys table (for future company dashboard access)
create table api_keys (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) on delete cascade,
  key_hash text not null unique,
  label text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table companies enable row level security;
alter table jobs enable row level security;
alter table api_keys enable row level security;

-- Jobs: public read for active jobs
create policy "Jobs are publicly readable"
  on jobs for select using (status = 'active');

-- Companies: public read for active (paid) companies
create policy "Companies are publicly readable"
  on companies for select using (plan_active = true);

-- Companies: authenticated users manage their own record
-- NOTE: We link auth.uid() to company via a user_id column (added below)
alter table companies add column if not exists user_id uuid references auth.users(id);

create policy "Users manage their own company"
  on companies for all
  using (auth.uid() = user_id);

-- Jobs: company owners can manage their own jobs
create policy "Company owners manage their jobs"
  on jobs for all
  using (
    company_id in (
      select id from companies where user_id = auth.uid()
    )
  );

-- API keys: owners only
create policy "Owners manage their api keys"
  on api_keys for all
  using (
    company_id in (
      select id from companies where user_id = auth.uid()
    )
  );

-- ============================================================
-- Indexes
-- ============================================================

create index jobs_company_id_idx on jobs(company_id);
create index jobs_status_idx on jobs(status);
create index jobs_posted_at_idx on jobs(posted_at desc);
create index jobs_skills_idx on jobs using gin(skills);
create index jobs_expires_at_idx on jobs(expires_at);
create index companies_user_id_idx on companies(user_id);

-- ============================================================
-- ============================================================
-- Helper function: increment job views (safe concurrent updates)
-- ============================================================

create or replace function increment_job_views(job_id uuid)
returns void as $$
  update jobs set views = views + 1 where id = job_id;
$$ language sql security definer;

-- ============================================================
-- Full-text search index for jobs
-- ============================================================

alter table jobs add column if not exists fts tsvector
  generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))
  ) stored;

create index jobs_fts_idx on jobs using gin(fts);
