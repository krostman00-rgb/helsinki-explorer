"use client";

/**
 * Module-level cache for the full /places list.
 *
 * The first call to `preloadPlaces()` or `getPlaces()` fires a single
 * Supabase fetch; every subsequent caller (Map, Discover, Accommodation
 * step, etc.) shares the same in-flight promise / cached array. This
 * eliminates the 5–10 s wait users were hitting on the Discover step.
 *
 * Strategy:
 *   • Welcome page calls `preloadPlaces()` on mount, well before the
 *     user has navigated through the 5 onboarding steps.
 *   • Map, Discover, Accommodation read via `getPlaces()` which returns
 *     the cached array (or awaits the in-flight promise).
 */

import { createClient } from "@/lib/supabase/client";
import type { Place } from "@/types/database.types";

let promise: Promise<Place[]> | null = null;
let cached:  Place[]  | null = null;

async function startFetch(): Promise<Place[]> {
  const { data, error } = await createClient()
    .from("places")
    .select("*")
    .order("name");
  if (error) {
    promise = null; // allow next caller to retry
    return [];
  }
  cached = (data as Place[]) ?? [];
  return cached;
}

/** Fire-and-forget. Safe to call multiple times — it'll only fetch once. */
export function preloadPlaces(): void {
  if (promise || cached) return;
  promise = startFetch();
}

/** Awaits cached or in-flight result. Triggers the fetch lazily. */
export function getPlaces(): Promise<Place[]> {
  if (cached) return Promise.resolve(cached);
  if (!promise) promise = startFetch();
  return promise;
}

/** Synchronously returns cached places (null if still loading). */
export function getCachedPlaces(): Place[] | null {
  return cached;
}

/** Force a refetch on next call. Useful after admin edits. */
export function invalidatePlaces(): void {
  promise = null;
  cached  = null;
}
