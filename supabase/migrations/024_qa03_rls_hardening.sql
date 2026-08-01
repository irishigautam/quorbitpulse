-- QA-03 (launch checklist) — several public-schema tables were exposed via
-- PostgREST (readable/writable with just the public anon key) because RLS
-- was never enabled on them at all. Confirmed via Supabase advisors:
--   ERROR rls_disabled_in_public: usage_events, company_invites,
--   candidate_mcp_tokens, mcp_pending_updates, job_listings,
--   career_page_sources, candidate_profiles, candidate_applications
-- company_invites.token and candidate_mcp_tokens.token are especially
-- sensitive (invite acceptance / MCP chat auth tokens) and were flagged as
-- ERROR "sensitive_columns_exposed" on top of the missing RLS.
--
-- Codebase audit (grep for createClient() vs createServiceClient() across
-- every file touching these tables) confirmed:
--   - usage_events, company_invites, candidate_mcp_tokens,
--     mcp_pending_updates, career_page_sources, candidate_applications are
--     accessed ONLY via the service-role client (which bypasses RLS), so
--     enabling RLS with zero policies is a pure lockdown with no behavior
--     change — matches the existing pattern already used for audit_log /
--     funnel_events / notification_log.
--   - job_listings is read directly by the public jobs board
--     (app/jobs/page.tsx, anon/authenticated client) and only ever written
--     by service-role scraper routes, so it gets the same
--     "publicly readable" SELECT policy already used on the `jobs` table.
--   - candidate_profiles is read by requireCandidate()/getCandidateForUser()
--     (lib/candidate-auth.ts, authenticated client, scoped to auth.uid()) and
--     inserted directly from the browser at signup
--     (app/candidate/signup/page.tsx) before a session may exist yet, so
--     INSERT is left open (no behavior change from today) while
--     SELECT/UPDATE/DELETE are locked to the owning user.
--
-- Applied live via Supabase MCP on 2026-08-02; this file mirrors it for
-- version history.

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_mcp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_pending_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_page_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Job listings are publicly readable" ON public.job_listings
  FOR SELECT
  USING (true);

CREATE POLICY "Candidates can insert their own profile" ON public.candidate_profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Candidates can view their own profile" ON public.candidate_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Candidates can update their own profile" ON public.candidate_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates can delete their own profile" ON public.candidate_profiles
  FOR DELETE
  USING (auth.uid() = user_id);
