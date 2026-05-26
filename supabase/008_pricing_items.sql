-- Adds a structured pricing_items column to places.
-- pricing_info (text) is kept for backward-compatibility.
-- New data should use pricing_items; the UI falls back to pricing_info if
-- pricing_items is null or empty.
--
-- Run manually in Supabase Studio SQL editor.

alter table public.places
  add column if not exists pricing_items jsonb;

-- Expected shape:
-- [
--   { "label": "Weekday single ticket", "price_eur": 19   },
--   { "label": "Child ticket (0–2)",    "price_eur": null  }   -- null = Free
-- ]
