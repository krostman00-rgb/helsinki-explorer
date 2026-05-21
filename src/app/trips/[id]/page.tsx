"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity, Place } from "@/types/database.types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ActivityWithPlace extends TripActivity {
  places: Pick<Place, "name" | "category" | "address"> | null;
}

interface DayWithActivities extends TripDay {
  trip_activities: ActivityWithPlace[];
}

// Category colour dots — matches HelloHel palette
const CATEGORY_TINT: Record<string, string> = {
  food:    "var(--hh-copper-600)",
  cafe:    "var(--hh-copper-600)",
  sauna:   "var(--hh-moss-700)",
  nature:  "var(--hh-moss-700)",
  museums: "var(--hh-baltic-700)",
  history: "var(--hh-baltic-700)",
  arch:    "var(--hh-baltic-700)",
  design:  "var(--hh-ink-900)",
  shop:    "var(--hh-copper-600)",
  night:   "var(--hh-amber-500)",
  events:  "var(--hh-amber-500)",
  family:  "var(--hh-moss-500)",
};

const TIME_LABELS = ["09:30", "12:00", "14:00", "17:30", "20:00"];

function ActivityCard({ activity, index }: { activity: ActivityWithPlace; index: number }) {
  const tint = CATEGORY_TINT[activity.places?.category ?? ""] ?? "var(--hh-stone-400)";
  const time = TIME_LABELS[index] ?? "";

  return (
    <div style={{ display: "flex", gap: 14, position: "relative" }}>
      {/* timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", width: 32 }}>
        <div style={{ width: 10, height: 10, borderRadius: 999, background: tint, flex: "0 0 auto", marginTop: 16, zIndex: 1 }}/>
        <div style={{ width: 1.5, flex: 1, background: "var(--hh-linen-300)", marginTop: 4 }}/>
      </div>

      {/* card */}
      <div style={{ flex: 1, padding: "12px 14px 14px", borderRadius: 16, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", marginBottom: 8, opacity: activity.completed ? 0.55 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-stone-500)", letterSpacing: "0.08em" }}>
            {time}{activity.duration_minutes ? ` · ${activity.duration_minutes} min` : ""}
          </div>
          {activity.completed && (
            <div style={{ width: 18, height: 18, borderRadius: 999, background: "var(--hh-moss-700)", display: "grid", placeItems: "center" }}>
              <svg width="9" height="8" viewBox="0 0 9 8" fill="none" aria-hidden><path d="M1 4L3.5 6.5L8 1" stroke="#FAF7F1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, color: "var(--hh-ink-900)", lineHeight: 1.15, letterSpacing: "-0.01em" }}>
          {activity.title}
        </div>
        {activity.places?.address && (
          <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "var(--hh-stone-500)", marginTop: 3 }}>
            {activity.places.address}
          </div>
        )}
        {activity.description && (
          <div style={{ fontSize: 13, lineHeight: 1.45, color: "var(--hh-ink-700)", marginTop: 6 }}>
            {activity.description}
          </div>
        )}
      </div>
    </div>
  );
}

function DaySection({ day }: { day: DayWithActivities }) {
  return (
    <div style={{ marginBottom: 36 }}>
      {/* Day header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "0.5px solid var(--hh-linen-300)" }}>
        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>DAY {day.day_number}</span>
        {day.title && (
          <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 20, color: "var(--hh-ink-900)", letterSpacing: "-0.01em" }}>
            {day.title}
          </span>
        )}
      </div>

      {/* Activities */}
      <div>
        {day.trip_activities.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--hh-stone-500)", fontStyle: "italic", padding: "8px 0" }}>No activities yet.</p>
        ) : (
          day.trip_activities
            .sort((a, b) => a.order_index - b.order_index)
            .map((act, i) => <ActivityCard key={act.id} activity={act} index={i}/>)
        )}
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DayWithActivities[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase.from("trips").select("*").eq("id", params.id).single(),
      supabase
        .from("trip_days")
        .select("*, trip_activities(*, places(name, category, address))")
        .eq("trip_id", params.id)
        .order("day_number"),
    ]).then(([tripRes, daysRes]) => {
      setTrip(tripRes.data);
      setDays((daysRes.data as unknown as DayWithActivities[]) ?? []);
      setIsLoading(false);
    });
  }, [params.id]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", background: "var(--hh-linen-100)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading…</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", gap: 16, background: "var(--hh-linen-100)" }}>
        <p style={{ color: "var(--hh-stone-500)" }}>Trip not found.</p>
        <Link href="/trips" className={buttonVariants({ variant: "outline" })}>← Back</Link>
      </div>
    );
  }

  const budgetMarks = "€".repeat(trip.budget_level);

  return (
    <div style={{ background: "var(--hh-linen-100)", minHeight: "calc(100dvh - 68px)" }}>
      {/* Header */}
      <div style={{ padding: "56px 24px 20px", borderBottom: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)" }}>
        <Link
          href="/trips"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-stone-500)", textDecoration: "none", marginBottom: 16 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          All trips
        </Link>

        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 34, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--hh-ink-900)", marginBottom: 8 }}>
          {trip.title}
        </div>

        <div style={{ display: "flex", gap: 16, fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.06em" }}>
          <span>{trip.duration_days} {trip.duration_days === 1 ? "day" : "days"}</span>
          <span>{budgetMarks} · per person per day</span>
          <span style={{ textTransform: "uppercase", color: trip.status === "active" ? "var(--hh-moss-700)" : "var(--hh-stone-500)" }}>
            {trip.status}
          </span>
        </div>

        {/* Interest tags */}
        {trip.interests.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
            {trip.interests.map(k => (
              <span key={k} style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, background: "var(--hh-linen-200)", color: "var(--hh-stone-500)", border: "0.5px solid var(--hh-linen-300)" }}>
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Day list */}
      <div style={{ padding: "24px 24px 40px" }}>
        {days.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>
              Itinerary is being built…
            </p>
          </div>
        ) : (
          days.map(day => <DaySection key={day.id} day={day}/>)
        )}
      </div>
    </div>
  );
}
