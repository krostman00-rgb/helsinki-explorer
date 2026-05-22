"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search, List, Map as MapIcon, SlidersHorizontal, Crosshair, Layers,
  Coffee, Utensils, Flame, Landmark, TreePine, Building2, Gem, Moon, ShoppingBag, Users, History, CalendarDays,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity, Place } from "@/types/database.types";
import type { MapActivity } from "@/components/TripMapView";

const TripMapView = dynamic(
  () => import("@/components/TripMapView").then((m) => m.TripMapView),
  { ssr: false, loading: () => <div style={{ width: "100%", height: "100%", background: "#EDE8DC" }}/> }
);

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const CATEGORY_COLOR: Record<string, string> = {
  food: "#B65A37", cafe: "#B65A37", shop: "#B65A37",
  sauna: "#3F5A45", nature: "#3F5A45", family: "#3F5A45",
  museums: "#133A5B", history: "#133A5B", arch: "#133A5B",
  design: "#1A1611", night: "#C99544", events: "#C99544",
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  cafe: Coffee, food: Utensils, sauna: Flame, museums: Landmark,
  history: History, nature: TreePine, family: Users, arch: Building2,
  design: Gem, shop: ShoppingBag, night: Moon, events: CalendarDays,
};

interface ActivityWithPlace extends TripActivity {
  places: Pick<Place, "name" | "category" | "lat" | "lng"> | null;
}
interface DayWithActivities extends TripDay {
  trip_activities: ActivityWithPlace[];
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default function MapPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [trip, setTrip]       = useState<Trip | null>(null);
  const [days, setDays]       = useState<DayWithActivities[]>([]);
  const [dayIdx, setDayIdx]   = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView]       = useState<"map" | "list">("map");
  const [isLoading, setLoading] = useState(true);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }
    (async () => {
      const sb = createClient();
      const { data: tripData } = await sb
        .from("trips")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (!tripData) { setLoading(false); return; }
      setTrip(tripData);

      const { data: daysData } = await sb
        .from("trip_days")
        .select("*, trip_activities(*, places(name, category, lat, lng))")
        .eq("trip_id", tripData.id)
        .order("day_number", { ascending: true });
      setDays((daysData as unknown as DayWithActivities[]) ?? []);
      setLoading(false);
    })();
  }, [user, authLoading]);

  // Scroll active card into view when selected changes
  useEffect(() => {
    const container = cardsRef.current;
    if (!container) return;
    const card = container.children[selectedIdx] as HTMLElement | undefined;
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedIdx]);

  const currentDay = days[dayIdx];
  const activities: ActivityWithPlace[] = currentDay?.trip_activities ?? [];
  const validActivities = activities.filter(a => a.places?.lat && a.places?.lng);

  const mapActivities: MapActivity[] = validActivities.map(a => ({
    id: a.id,
    completed: a.completed ?? false,
    places: a.places ? {
      category: a.places.category,
      lat: a.places.lat,
      lng: a.places.lng,
    } : null,
  }));

  const handleMarkerClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 68px)", background: "#EDE8DC" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-400)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 68px)", background: "#EDE8DC", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, color: "var(--hh-linen-300)" }}>No trip yet.</div>
        <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-stone-400)" }}>Plan a trip first to see it on the map.</div>
      </div>
    );
  }

  const dayName = currentDay?.date
    ? (DAY_NAMES[new Date(currentDay.date + "T12:00:00").getDay()] ?? "—")
    : "—";
  const dayNumber = currentDay ? pad2(currentDay.day_number) : "01";
  const stopCount = validActivities.length;

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100dvh - 68px)", overflow: "hidden" }}>

      {/* ── Full-screen map ── */}
      {view === "map" && (
        <div style={{ position: "absolute", inset: 0 }}>
          <TripMapView
            activities={mapActivities}
            selectedIdx={selectedIdx}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div style={{ position: "absolute", inset: 0, background: "var(--hh-linen-100)", overflowY: "auto", padding: "16px 20px 200px" }}>
          {validActivities.map((act, i) => {
            const cat  = act.places?.category ?? "";
            const Icon = CATEGORY_ICON[cat] ?? Gem;
            const color = CATEGORY_COLOR[cat] ?? "#B5A992";
            const active = i === selectedIdx;
            return (
              <button
                key={act.id}
                onClick={() => { setSelectedIdx(i); setView("map"); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: `0.5px solid ${active ? "transparent" : "var(--hh-linen-300)"}`, cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? "rgba(250,247,241,0.12)" : "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                  <Icon size={16} color={active ? "#FAF7F1" : color} strokeWidth={1.5}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, lineHeight: 1.1, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 2 }}>
                    {act.places?.name ?? "—"}
                  </div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: active ? "rgba(250,247,241,0.55)" : "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {cat}
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: active ? "rgba(250,247,241,0.4)" : "var(--hh-stone-400)", fontWeight: 600 }}>
                  {pad2(i + 1)}
                </div>
              </button>
            );
          })}
          {validActivities.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 80, fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-stone-400)" }}>
              No stops with location data.
            </div>
          )}
        </div>
      )}

      {/* ── Top bar: search + list/map toggle ── */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 20, display: "flex", gap: 8, alignItems: "center" }}>
        {/* Search pill */}
        <div style={{ flex: 1, height: 44, borderRadius: 999, background: "rgba(250,247,241,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(180,165,145,0.4)", boxShadow: "0 2px 16px rgba(26,22,17,0.12)", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
          <Search size={15} color="var(--hh-stone-400)" strokeWidth={1.8}/>
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13.5, color: "var(--hh-stone-400)", letterSpacing: "0.01em" }}>Search places…</span>
        </div>

        {/* List / Map toggle */}
        <div style={{ display: "flex", borderRadius: 999, background: "rgba(250,247,241,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(180,165,145,0.4)", boxShadow: "0 2px 16px rgba(26,22,17,0.12)", overflow: "hidden" }}>
          {(["map", "list"] as const).map(v => {
            const active = view === v;
            const Icon = v === "map" ? MapIcon : List;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{ width: 44, height: 44, border: "none", background: active ? "var(--hh-ink-900)" : "transparent", display: "grid", placeItems: "center", cursor: "pointer", transition: "background 0.15s" }}
              >
                <Icon size={16} color={active ? "#FAF7F1" : "var(--hh-stone-500)"} strokeWidth={1.8}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day context pill (top-left below search) ── */}
      <div style={{ position: "absolute", top: 72, left: 16, zIndex: 20 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 14px", borderRadius: 999, background: "rgba(26,22,17,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "0.5px solid rgba(250,247,241,0.12)" }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(250,247,241,0.9)", letterSpacing: "0.1em" }}>
            {dayName.toUpperCase()} · Day {dayNumber} · {pad2(stopCount)} stops
          </span>
        </div>
      </div>

      {/* ── Day switcher pills (if multi-day) ── */}
      {days.length > 1 && (
        <div style={{ position: "absolute", top: 112, left: 16, zIndex: 20, display: "flex", gap: 6 }}>
          {days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => { setDayIdx(i); setSelectedIdx(0); }}
              style={{ height: 26, padding: "0 10px", borderRadius: 999, border: "none", background: i === dayIdx ? "var(--hh-copper-600)" : "rgba(250,247,241,0.82)", backdropFilter: "blur(8px)", cursor: "pointer", fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: i === dayIdx ? "#FAF7F1" : "var(--hh-stone-500)", letterSpacing: "0.08em" }}
            >
              D{pad2(d.day_number)}
            </button>
          ))}
        </div>
      )}

      {/* ── Right-side controls (map only) ── */}
      {view === "map" && (
        <div style={{ position: "absolute", top: 72, right: 16, zIndex: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: SlidersHorizontal, label: "Filter" },
            { icon: Crosshair,         label: "Center" },
            { icon: Layers,            label: "Layers" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(250,247,241,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", boxShadow: "0 2px 12px rgba(26,22,17,0.12)", display: "grid", placeItems: "center", cursor: "pointer", border: "0.5px solid rgba(180,165,145,0.3)" }}
            >
              <Icon size={16} color="var(--hh-stone-600)" strokeWidth={1.8}/>
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom swipeable activity cards ── */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, paddingBottom: 20 }}>
        {/* Gradient fade */}
        <div style={{ height: 56, background: "linear-gradient(to top, rgba(237,232,220,0.6) 0%, transparent 100%)", pointerEvents: "none" }}/>

        <div
          ref={cardsRef}
          style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 20px 0", scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
        >
          {validActivities.map((act, i) => {
            const cat   = act.places?.category ?? "";
            const Icon  = CATEGORY_ICON[cat] ?? Gem;
            const color = CATEGORY_COLOR[cat] ?? "#B5A992";
            const active = i === selectedIdx;

            return (
              <button
                key={act.id}
                onClick={() => setSelectedIdx(i)}
                style={{
                  flex: "0 0 auto",
                  width: 200,
                  minWidth: 200,
                  padding: "14px 16px",
                  borderRadius: 20,
                  background: active ? "var(--hh-ink-900)" : "rgba(250,247,241,0.94)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: `0.5px solid ${active ? "transparent" : "rgba(180,165,145,0.3)"}`,
                  boxShadow: active ? "0 4px 20px rgba(26,22,17,0.30)" : "0 2px 12px rgba(26,22,17,0.10)",
                  cursor: "pointer",
                  textAlign: "left",
                  scrollSnapAlign: "center",
                  transition: "background 0.2s, box-shadow 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(250,247,241,0.10)" : "var(--hh-linen-200)", display: "grid", placeItems: "center" }}>
                    <Icon size={14} color={active ? "#FAF7F1" : color} strokeWidth={1.6}/>
                  </div>
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 700, color: active ? "rgba(250,247,241,0.35)" : "var(--hh-stone-300)", letterSpacing: "0.06em" }}>
                    {pad2(i + 1)}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 16, lineHeight: 1.15, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 4, letterSpacing: "-0.01em" }}>
                  {act.places?.name ?? "—"}
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: active ? "rgba(250,247,241,0.45)" : "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {cat}
                </div>
              </button>
            );
          })}

          {validActivities.length === 0 && (
            <div style={{ width: "100%", textAlign: "center", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "rgba(250,247,241,0.6)", padding: "16px 0" }}>
              No stops on this day.
            </div>
          )}
          {/* trailing spacer */}
          <div style={{ flex: "0 0 8px" }}/>
        </div>
      </div>
    </div>
  );
}
