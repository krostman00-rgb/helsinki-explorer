-- Fix: add missing columns to places table if they don't exist
-- Run this in Supabase SQL Editor, then run 001_initial_schema.sql again
-- (or just run this + the seed block below)

alter table public.places
  add column if not exists name_fi         text,
  add column if not exists description_fi  text,
  add column if not exists image_url       text,
  add column if not exists rating          numeric(2,1),
  add column if not exists price_level     integer,
  add column if not exists tags            text[] not null default '{}',
  add column if not exists opening_hours   jsonb,
  add column if not exists website         text;
