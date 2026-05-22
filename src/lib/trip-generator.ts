import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Place } from "@/types/database.types";

// How many activities fit per day at each budget level
const ACTIVITIES_PER_DAY: Record<number, number> = { 1: 3, 2: 4, 3: 5 };

// Morning, lunch, afternoon, evening, night slots — titles shown in the UI
const TIME_SLOTS = [
  { label: "Morning",   time: "09:30", duration: 90  },
  { label: "Lunch",     time: "12:00", duration: 75  },
  { label: "Afternoon", time: "14:00", duration: 120 },
  { label: "Evening",   time: "17:30", duration: 120 },
  { label: "Night",     time: "20:00", duration: 90  },
];

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
  priorityPlaceIds: string[] = []
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
  const activitiesPerDay = ACTIVITIES_PER_DAY[budgetLevel] ?? 3;
  const usedPlaceIds = new Set<string>();

  for (let dayIndex = 0; dayIndex < durationDays; dayIndex++) {
    // 2. Insert trip_day row
    const { data: day, error: dayError } = await supabase
      .from("trip_days")
      .insert({
        trip_id:    tripId,
        day_number: dayIndex + 1,
        title:      getDayTheme(dayIndex, durationDays),
      })
      .select()
      .single();

    if (dayError || !day) {
      console.error(`Failed to create day ${dayIndex + 1}:`, dayError?.message);
      continue;
    }

    // 3. Score and rank places — user-picked places get a big priority boost
    const scored = eligible
      .filter(p => !usedPlaceIds.has(p.id))
      .map(p => ({
        place: p,
        score: scorePlace(p, interests) + (priorityPlaceIds.includes(p.id) ? 100 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    const picked = scored.slice(0, activitiesPerDay).map(s => s.place);
    picked.forEach(p => usedPlaceIds.add(p.id));

    // 4. Insert trip_activities for each picked place
    const activityRows = picked.map((place, i) => {
      const slot = TIME_SLOTS[i] ?? TIME_SLOTS[TIME_SLOTS.length - 1];
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
