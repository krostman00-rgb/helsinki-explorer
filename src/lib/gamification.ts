import { createClient } from "@/lib/supabase/client";

export const POINTS_PER_ACTIVITY = 20;

export interface AchievementDef {
  key: string;
  title: string;
  titleFi: string;
  hint: string;
  icon: string;
  points: number;
  category: string;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    key: "first_trip",
    title: "Helsinki Rookie",
    titleFi: "Helsinki Rookie",
    hint: "Create your first Helsinki trip.",
    icon: "🗺", points: 50, category: "milestone",
  },
  {
    key: "cafe_5",
    title: "Aamukahvi",
    titleFi: "Aamukahvi",
    hint: "Visit 5 cafés. The cinnamon bun life chose you.",
    icon: "☕", points: 100, category: "food",
  },
  {
    key: "sauna_3",
    title: "Saunamestari",
    titleFi: "Sauna master",
    hint: "One more sauna and you join the order. Try Kotiharju in Kallio.",
    icon: "♨", points: 150, category: "sauna",
  },
  {
    key: "suomenlinna",
    title: "Saaristoseilari",
    titleFi: "Island sailor",
    hint: "Take the ferry to Suomenlinna. Only 15 minutes from Market Square.",
    icon: "⛵", points: 75, category: "nature",
  },
  {
    key: "design_5",
    title: "Designsisäänpiiri",
    titleFi: "Design circle",
    hint: "Helsinki is a design city. Explore 5 design or architecture stops.",
    icon: "◎", points: 100, category: "design",
  },
  {
    key: "food_3",
    title: "Kalakukko",
    titleFi: "Finnish food lover",
    hint: "Taste 3 traditional Finnish dishes. Salmon soup counts.",
    icon: "🐟", points: 100, category: "food",
  },
  {
    key: "night_1",
    title: "Yömyssy",
    titleFi: "Night owl",
    hint: "Helsinki has a nightlife. Visit somewhere open past 22:00.",
    icon: "🌙", points: 75, category: "nightlife",
  },
  {
    key: "all_complete",
    title: "Helsinki sydämessä",
    titleFi: "Helsinki at heart",
    hint: "Complete every activity in a trip.",
    icon: "❤", points: 200, category: "milestone",
  },
];

export interface CompletedCounts {
  cafe: number;
  sauna: number;
  food: number;
  design: number;
  arch: number;
  suomenlinna: boolean;
  night: boolean;
  allComplete: boolean;
  total: number;
}

export function getAchievementProgress(
  key: string,
  counts: CompletedCounts,
): { current: number; total: number } {
  switch (key) {
    case "cafe_5":       return { current: Math.min(counts.cafe, 5), total: 5 };
    case "sauna_3":      return { current: Math.min(counts.sauna, 3), total: 3 };
    case "food_3":       return { current: Math.min(counts.food, 3), total: 3 };
    case "design_5":     return { current: Math.min(counts.design + counts.arch, 5), total: 5 };
    case "suomenlinna":  return { current: counts.suomenlinna ? 1 : 0, total: 1 };
    case "night_1":      return { current: counts.night ? 1 : 0, total: 1 };
    case "all_complete": return { current: counts.allComplete ? 1 : 0, total: 1 };
    case "first_trip":   return { current: 1, total: 1 };
    default:             return { current: 0, total: 1 };
  }
}

export async function markActivityDone(
  userId: string,
  activityId: string,
  placeName: string,
  placeCategory: string,
  placeTags: string[],
  tripId: string,
): Promise<{ pointsEarned: number; newAchievements: AchievementDef[] }> {
  const supabase = createClient();

  // 1. Mark activity completed
  await supabase
    .from("trip_activities")
    .update({ completed: true })
    .eq("id", activityId);

  // 2. Get current profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_points, level")
    .eq("user_id", userId)
    .single();

  const currentPoints = profile?.total_points ?? 0;
  const earned = POINTS_PER_ACTIVITY;

  // 3. Record points and update total
  await Promise.all([
    supabase.from("points_history").insert({
      user_id: userId,
      points: earned,
      reason: `Visited ${placeName}`,
      reference_id: activityId,
      reference_type: "trip_activity",
    }),
    supabase.from("profiles").update({
      total_points: currentPoints + earned,
    }).eq("user_id", userId),
  ]);

  // 4. Compute updated counts from all completed activities across all trips
  const { data: completed } = await supabase
    .from("trip_activities")
    .select("places(category, tags, name)")
    .eq("completed", true)
    .in(
      "trip_day_id",
      (await supabase
        .from("trip_days")
        .select("id")
        .in(
          "trip_id",
          (await supabase.from("trips").select("id").eq("user_id", userId)).data?.map(t => t.id) ?? []
        )).data?.map(d => d.id) ?? []
    );

  // Also get total activities in this trip to check all_complete
  const { data: allActs } = await supabase
    .from("trip_activities")
    .select("completed, trip_day_id")
    .in(
      "trip_day_id",
      (await supabase.from("trip_days").select("id").eq("trip_id", tripId)).data?.map(d => d.id) ?? []
    );

  const counts: CompletedCounts = {
    cafe: 0, sauna: 0, food: 0, design: 0, arch: 0,
    suomenlinna: false, night: false,
    allComplete: (allActs?.every(a => a.completed) && (allActs?.length ?? 0) > 0) ?? false,
    total: completed?.length ?? 0,
  };

  for (const act of completed ?? []) {
    const p = act.places as unknown as { category: string; tags: string[]; name: string } | null;
    if (!p) continue;
    if (p.category === "cafe")    counts.cafe++;
    if (p.category === "sauna")   counts.sauna++;
    if (p.category === "food")    counts.food++;
    if (p.category === "design")  counts.design++;
    if (p.category === "arch")    counts.arch++;
    if (p.category === "night")   counts.night = true;
    if (p.name?.toLowerCase().includes("suomenlinna")) counts.suomenlinna = true;
  }

  // 5. Check which achievements are newly unlocked
  const { data: existingUnlocks } = await supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", userId);

  const { data: achievementRows } = await supabase
    .from("achievements")
    .select("id, key, points");

  const unlockedIds = new Set(existingUnlocks?.map(u => u.achievement_id) ?? []);
  const newAchievements: AchievementDef[] = [];
  let bonusPoints = 0;

  for (const row of achievementRows ?? []) {
    if (unlockedIds.has(row.id)) continue;
    const prog = getAchievementProgress(row.key, counts);
    if (prog.current >= prog.total) {
      await supabase.from("user_achievements").insert({
        user_id: userId,
        achievement_id: row.id,
      });
      bonusPoints += row.points ?? 0;
      const def = ACHIEVEMENT_DEFS.find(d => d.key === row.key);
      if (def) newAchievements.push(def);
    }
  }

  // 6. Apply bonus points if any achievements unlocked
  if (bonusPoints > 0) {
    const { data: freshProfile } = await supabase
      .from("profiles")
      .select("total_points")
      .eq("user_id", userId)
      .single();
    await supabase.from("profiles").update({
      total_points: (freshProfile?.total_points ?? 0) + bonusPoints,
    }).eq("user_id", userId);
  }

  return { pointsEarned: earned + bonusPoints, newAchievements };
}
