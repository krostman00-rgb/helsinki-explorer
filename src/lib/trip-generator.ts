import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Place } from "@/types/database.types";

// How many activities fit per day at each budget level (max cap)
const ACTIVITIES_PER_DAY: Record<number, number> = { 1: 3, 2: 4, 3: 5 };

// All possible time slots ordered earliest → latest
const TIME_SLOTS = [
  { label: "Morning",   time: "09:30", duration: 90  },
  { label: "Lunch",     time: "12:00", duration: 75  },
  { label: "Afternoon", time: "14:00", duration: 120 },
  { label: "Evening",   time: "17:30", duration: 120 },
  { label: "Night",     time: "20:00", duration: 90  },
];

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns the subset of TIME_SLOTS that are usable given arrival / departure
 * constraints for a specific day of the trip.
 *
 * Day 1  – only slots whose start time is at or after the arrival time
 *           (so the traveller can actually reach the venue).
 * Last day – only slots that finish (start + duration) with at least 60 min
 *           spare before the departure time (travel buffer to airport/station).
 * Other days – all slots, capped to ACTIVITIES_PER_DAY[budgetLevel].
 */
function availableSlots(
  dayIndex: number,
  totalDays: number,
  budgetLevel: number,
  arrivalTime?: string,
  departureTime?: string,
): typeof TIME_SLOTS {
  const cap = ACTIVITIES_PER_DAY[budgetLevel] ?? 3;
  let slots = [...TIME_SLOTS];

  // Day 1: remove slots that start before arrival
  if (dayIndex === 0 && arrivalTime) {
    const arrMin = toMin(arrivalTime);
    slots = slots.filter(s => toMin(s.time) >= arrMin);
  }

  // Last day: remove slots that would end too close to departure
  if (dayIndex === totalDays - 1 && departureTime) {
    const depMin = toMin(departureTime);
    const BUFFER = 60; // 60 min to get to airport/station
    slots = slots.filter(s => toMin(s.time) + s.duration + BUFFER <= depMin);
  }

  // Never exceed the budget cap
  return slots.slice(0, cap);
}

/** Add N calendar days to a yyyy-MM-dd string */
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Day theme names based on trip length — adds editorial flavour to each day card
const DAY_THEMES: Record<number, string[]> = {
  1: ["The whole city in a day"],
  2: ["City centre & sea", "Design & neighbourhoods"],
  3: ["Centre & harbour", "Archipelago & saunas", "Design & local life"],
  4: ["Arrival & Market Square", "Archipelago day", "Design District", "Kallio & nightlife"],
  5: ["Arrival & waterfront", "Suomenlinna island", "Museums & culture", "Design & cafés", "Local neighbourhoods"],
  7: ["Arrival & orientation", "Archipelago & Suomenlinna", "Museums & Kiasma", "Design District & shopping", "Saunas & sea", "Kallio & food scene", "Your way"],
};

function getDayTheme(dayIndex: number, totalDays: number): string {
  const themes = DAY_THEMES[Math.min(totalDays, 7)] ?? DAY_THEMES[7];
  return themes[dayIndex] ?? `Day ${dayIndex + 1}`;
}

// Score a place against user interests — higher = more relevant
function scorePlace(place: Place, interests: string[]): number {
  const categoryMatch: Record<string, string[]> = {
    food:    ["food", "cafe"],
    sauna:   ["sauna"],
    museums: ["museums"],
    design:  ["design", "shop"],
    nature:  ["nature"],
    night:   ["night"],
    arch:    ["arch", "museums"],
    shop:    ["shop", "design"],
    family:  ["nature", "museums", "food"],
    history: ["history", "museums", "arch"],
    cafe:    ["cafe", "food"],
    events:  ["events", "museums"],
  };

  let score = 0;
  for (const interest of interests) {
    const matched = categoryMatch[interest] ?? [];
    if (matched.includes(place.category)) score += 10;
  }
  // Slight random jitter so every trip feels different
  score += Math.random() * 3;
  return score;
}

// Filter places by budget level — budget 1 includes price_level 1,
// budget 2 includes 1–2, budget 3 includes all
function filterByBudget(places: Place[], budgetLevel: number): Place[] {
  return places.filter(p => (p.price_level ?? 1) <= budgetLevel);
}

export async function generateTripDays(
  supabase: SupabaseClient<Database>,
  tripId: string,
  durationDays: number,
  budgetLevel: number,
  interests: string[],
  priorityPlaceIds: string[] = [],
  arrivalDate?: string | null,
  arrivalTime?: string | null,
  departureDate?: string | null,
  departureTime?: string | null,
): Promise<void> {
  // 1. Fetch all Helsinki places
  const { data: allPlaces, error: placesError } = await supabase
    .from("places")
    .select("*");

  if (placesError || !allPlaces?.length) {
    console.error("Could not load places:", placesError?.message);
    return;
  }

  const eligible = filterByBudget(allPlaces, budgetLevel);
  const usedPlaceIds = new Set<string>();

  for (let dayIndex = 0; dayIndex < durationDays; dayIndex++) {
    // 2. Compute the calendar date for this day (if we have an arrival date)
    const dayDate = arrivalDate ? addDays(arrivalDate, dayIndex) : null;

    // 3. Determine which time slots are usable today
    const slots = availableSlots(
      dayIndex,
      durationDays,
      budgetLevel,
      arrivalTime ?? undefined,
      departureTime ?? undefined,
    );

    // 4. Build a meaningful day title
    let title = getDayTheme(dayIndex, durationDays);
    if (dayIndex === 0 && arrivalTime) {
      const h = parseInt(arrivalTime.split(":")[0] ?? "0", 10);
      if (h >= 17) title = "Evening arrival — easy first night";
      else if (h >= 12) title = "Afternoon arrival — let Helsinki begin";
    }
    if (dayIndex === durationDays - 1 && departureTime) {
      const h = parseInt(departureTime.split(":")[0] ?? "0", 10);
      if (h < 14) title = "Last morning — light & unhurried";
    }

    // 5. Insert trip_day row
    const { data: day, error: dayError } = await supabase
      .from("trip_days")
      .insert({
        trip_id:    tripId,
        day_number: dayIndex + 1,
        title,
        date:       dayDate,
      })
      .select()
      .single();

    if (dayError || !day) {
      console.error(`Failed to create day ${dayIndex + 1}:`, dayError?.message);
      continue;
    }

    // 6. If no slots fit (e.g. 4-hour layover), skip activities for this day
    if (slots.length === 0) continue;

    // 7. Score and rank places — user-picked places get a big priority boost
    const scored = eligible
      .filter(p => !usedPlaceIds.has(p.id))
      .map(p => ({
        place: p,
        score: scorePlace(p, interests) + (priorityPlaceIds.includes(p.id) ? 100 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const picked = scored.slice(0, slots.length).map(s => s.place);
    picked.forEach(p => usedPlaceIds.add(p.id));

    // 8. Insert trip_activities using the filtered slots
    const activityRows = picked.map((place, i) => {
      const slot = slots[i] ?? slots[slots.length - 1]!;
      return {
        trip_day_id:      day.id,
        place_id:         place.id,
        title:            place.name,
        description:      place.description ?? undefined,
        order_index:      i,
        duration_minutes: slot.duration,
        completed:        false,
      };
    });

    const { error: actError } = await supabase
      .from("trip_activities")
      .insert(activityRows);

    if (actError) {
      console.error(`Failed to create activities for day ${dayIndex + 1}:`, actError.message);
    }
  }
}
