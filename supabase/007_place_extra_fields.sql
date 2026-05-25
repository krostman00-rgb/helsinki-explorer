-- Adds optional contextual fields to places.
-- All NULL-able — empty fields simply don't render on the public page.
--
-- Run manually in Supabase Studio SQL editor.

alter table public.places
  add column if not exists pricing_info     text,
  add column if not exists phone            text,
  add column if not exists email            text,
  add column if not exists reservation_url  text;

-- opening_hours already exists as jsonb.
-- Expected shape: { "mon": { "open": "09:00", "close": "18:00" }, "tue": ..., ... }
-- Days where the place is closed are simply omitted or set to null.
