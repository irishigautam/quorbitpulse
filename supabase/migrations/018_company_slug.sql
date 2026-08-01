-- Fix: /company/[slug] and the dashboard "Company page" link both 404'd for
-- every company, because `companies` never had a `slug` column at all —
-- confirmed via schema.sql/migrations search. The page's lookup
-- (.eq('slug', params.slug)) always errored/returned null.
--
-- Auto-generates a unique slug (name, slugified, + 8-char id suffix so
-- collisions are impossible) via a BEFORE INSERT trigger, so existing
-- signup code needs no changes. Backfills any existing companies.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION set_company_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN base_slug := 'company'; END IF;
    NEW.slug := base_slug || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_company_slug ON companies;
CREATE TRIGGER trg_set_company_slug
  BEFORE INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION set_company_slug();

-- Backfill existing rows
UPDATE companies
SET slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
