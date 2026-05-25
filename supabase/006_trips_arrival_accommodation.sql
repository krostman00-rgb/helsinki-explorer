-- Migration 006: Add arrival/departure times and accommodation to trips table
-- Run this in Supabase Studio → SQL Editor

alter table public.trips
  add column if not exists arrival_date          date,
  add column if not exists arrival_time          text,
  add column if not exists departure_date        date,
  add column if not exists departure_time        text,
  add column if not exists accommodation_name    text,
  add column if not exists accommodation_address text,
  add column if not exists accommodation_lat     double precision,
  add column if not exists accommodation_lng     double precision;
