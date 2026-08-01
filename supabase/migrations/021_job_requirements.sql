-- Job-creation flow gap: "Requirements" was folded entirely into the
-- free-text description with no distinct field, schema column, or UI. Adds
-- a dedicated, optional requirements field (rich text, same shape as
-- description) so employers can separate "about the role" narrative from
-- a structured must-have list.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements TEXT;
