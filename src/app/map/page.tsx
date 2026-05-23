"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search, List, Map as MapIcon,
  Coffee, Utensils, Flame, Landmark, TreePine, Building2, Gem, Moon, ShoppingBag, Users, History, CalendarDays,
  Star, MapPin, X,
} from "lucide-react";
import { useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity, Place } from "@/types/database.types";
import type { MapActivity, MapPlace } from "@/components/TripMapView";

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

const CATEGORY_LABEL: Record<string, string> = {
  food: "Restaurant", cafe: "Café", sauna: "Sauna", museums: "Museum",
  history: "Historic", nature: "Nature", family: "Family", arch: "Architecture",
  design: "Design", shop: "Shopping", night: "Nightlife", events: "Events",
};

const PRICE_MARK: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€" };

const FILTER_CATEGORIES = [
  { k: "all",     label: "All" },
  { k: "food",    label: "Food" },
  { k: "cafe",    label: "Café" },
  { k: "sauna",   label: "Sauna" },
  { k: "museums", label: "Museum" },
  { k: "nature",  label: "Nature" },
  { k: "arch",    label: "Arch" },
  { k: "design",  label: "Design" },
  { k: "shop",    label: "Shop" },
];

interface ActivityWithPlace extends TripActivity {
  places: Pick<Place, "name" | "category" | "lat" | "lng"> | null;
}
interface DayWithActivities extends TripDay {
  trip_activities: ActivityWithPlace[];
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default function MapPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [trip, setTrip]           = useState<Trip | null>(null);
  const [days, setDays]           = useState<DayWithActivities[]>([]);
  const [dayIdx, setDayIdx]       = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView]           = useState<"map" | "list">("map");
  const [isLoading, setLoading]   = useState(true);

  const [allPlaces, setAllPlaces]         = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [filterCat, setFilterCat]         = useState("all");

  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = createClient();

    // Always fetch all places
    sb.from("places").select("id, name, category, lat, lng, description, address, rating, price_level")
      .then(({ data }) => {
        if (data) setAllPlaces(data as MapPlace[]);
      });

    // Fetch trip only if user is available
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }

    (async () => {
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

  useEffect(() => {
    const container = cardsRef.current;
    if (!container) return;
    const card = container.children[selectedIdx] as HTMLElement | undefined;
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIdx]);

  const currentDay = days[dayIdx];
  const activities: ActivityWithPlace[] = currentDay?.trip_activities ?? [];
  const validActivities = activities.filter(a => a.places?.lat && a.places?.lng);

  const mapActivities: MapActivity[] = validActivities.map(a => ({
    id: a.id,
    completed: a.completed ?? false,
    places: a.places ? { category: a.places.category, lat: a.places.lat, lng: a.places.lng } : null,
  }));

  const filteredPlaces = useMemo(
    () => filterCat === "all" ? allPlaces : allPlaces.filter(p => p.category === filterCat),
    [allPlaces, filterCat]
  );

  const handleMarkerClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setSelectedPlace(null);
  }, []);

  const handlePlaceClick = useCallback((place: MapPlace) => {
    setSelectedPlace(place);
    setSelectedIdx(-1);
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 68px)", background: "#EDE8DC" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-400)", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  const dayName = currentDay?.date
    ? (DAY_NAMES[new Date(currentDay.date + "T12:00:00").getDay()] ?? "—")
    : "—";
  const dayNumber  = currentDay ? pad2(currentDay.day_number) : "01";
  const stopCount  = validActivities.length;

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100dvh - 68px)", overflow: "hidden" }}>

      {/* ── Full-screen map ── */}
      {view === "map" && (
        <div style={{ position: "absolute", inset: 0 }}>
          <TripMapView
            activities={mapActivities}
            selectedIdx={selectedIdx}
            onMarkerClick={handleMarkerClick}
            allPlaces={filteredPlaces}
            selectedPlaceId={selectedPlace?.id ?? null}
            onPlaceClick={handlePlaceClick}
          />
        </div>
      )}

      {/* ── List view ── */}
      {view === "list" && (
        <div style={{ position: "absolute", inset: 0, background: "var(--hh-linen-100)", overflowY: "auto", padding: "16px 20px 200px" }}>
          {/* Category filter row */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 16, paddingBottom: 4 }}>
            {FILTER_CATEGORIES.map(({ k, label }) => (
              <button key={k} onClick={() => setFilterCat(k)} style={{ flex: "0 0 auto", height: 30, padding: "0 14px", borderRadius: 999, border: "none", background: filterCat === k ? "var(--hh-ink-900)" : "var(--hh-linen-200)", fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: 500, color: filterCat === k ? "#FAF7F1" : "var(--hh-stone-500)", cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Trip activities section */}
          {trip && validActivities.length > 0 && (
            <>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Your trip · Day {dayNumber}</div>
              {validActivities.map((act, i) => {
                const cat  = act.places?.category ?? "";
                const Icon = CATEGORY_ICON[cat] ?? Gem;
                const color = CATEGORY_COLOR[cat] ?? "#B5A992";
                const active = i === selectedIdx;
                return (
                  <button key={act.id} onClick={() => { setSelectedIdx(i); setView("map"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: `0.5px solid ${active ? "transparent" : "var(--hh-linen-300)"}`, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? "rgba(250,247,241,0.12)" : "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <Icon size={16} color={active ? "#FAF7F1" : color} strokeWidth={1.5}/>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, lineHeight: 1.1, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 2 }}>{act.places?.name ?? "—"}</div>
                      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: active ? "rgba(250,247,241,0.55)" : "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: active ? "rgba(250,247,241,0.4)" : "var(--hh-stone-400)", fontWeight: 600 }}>{pad2(i + 1)}</div>
                  </button>
                );
              })}
              <div style={{ height: 1, background: "var(--hh-linen-300)", margin: "16px 0" }}/>
            </>
          )}

          {/* All places section */}
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Explore Helsinki · {filteredPlaces.length} places</div>
          {filteredPlaces.map(place => {
            const Icon  = CATEGORY_ICON[place.category] ?? Gem;
            const color = CATEGORY_COLOR[place.category] ?? "#B5A992";
            const active = place.id === selectedPlace?.id;
            return (
              <button key={place.id} onClick={() => { setSelectedPlace(place); setView("map"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: `0.5px solid ${active ? "transparent" : "var(--hh-linen-300)"}`, cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? "rgba(250,247,241,0.12)" : "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                  <Icon size={16} color={active ? "#FAF7F1" : color} strokeWidth={1.5}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, lineHeight: 1.1, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 2 }}>{place.name}</div>
                  <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: active ? "rgba(250,247,241,0.65)" : "var(--hh-stone-400)", lineHeight: 1.4 }}>{place.address}</div>
                </div>
                {place.rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "var(--font-geist-mono)", fontSize: 11, color: active ? "rgba(250,247,241,0.6)" : "var(--hh-stone-400)" }}>
                    <Star size={10} strokeWidth={1.5}/>{place.rating}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, height: 44, borderRadius: 999, background: "rgba(250,247,241,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(180,165,145,0.4)", boxShadow: "0 2px 16px rgba(26,22,17,0.12)", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
          <Search size={15} color="var(--hh-stone-400)" strokeWidth={1.8}/>
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13.5, color: "var(--hh-stone-400)" }}>Search places…</span>
        </div>
        <div style={{ display: "flex", borderRadius: 999, background: "rgba(250,247,241,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(180,165,145,0.4)", boxShadow: "0 2px 16px rgba(26,22,17,0.12)", overflow: "hidden" }}>
          {(["map", "list"] as const).map(v => {
            const active = view === v;
            const Icon = v === "map" ? MapIcon : List;
            return (
              <button key={v} onClick={() => setView(v)} style={{ width: 44, height: 44, border: "none", background: active ? "var(--hh-ink-900)" : "transparent", display: "grid", placeItems: "center", cursor: "pointer", transition: "background 0.15s" }}>
                <Icon size={16} color={active ? "#FAF7F1" : "var(--hh-stone-500)"} strokeWidth={1.8}/>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Category filter chips (map view) ── */}
      {view === "map" && (
        <div style={{ position: "absolute", top: 72, left: 0, right: 0, zIndex: 20, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 16px" }}>
          {FILTER_CATEGORIES.map(({ k, label }) => (
            <button key={k} onClick={() => setFilterCat(k)} style={{ flex: "0 0 auto", height: 28, padding: "0 12px", borderRadius: 999, border: "none", background: filterCat === k ? "var(--hh-ink-900)" : "rgba(250,247,241,0.88)", backdropFilter: "blur(8px)", fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: filterCat === k ? 600 : 400, color: filterCat === k ? "#FAF7F1" : "var(--hh-stone-600)", cursor: "pointer", boxShadow: "0 1px 8px rgba(26,22,17,0.10)" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Trip day context pill ── */}
      {trip && view === "map" && (
        <div style={{ position: "absolute", top: 112, left: 16, zIndex: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 14px", borderRadius: 999, background: "rgba(26,22,17,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: "0.5px solid rgba(250,247,241,0.12)" }}>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(250,247,241,0.9)", letterSpacing: "0.1em" }}>
              {dayName.toUpperCase()} · Day {dayNumber} · {pad2(stopCount)} stops
            </span>
          </div>
        </div>
      )}

      {/* ── Day switcher ── */}
      {trip && days.length > 1 && view === "map" && (
        <div style={{ position: "absolute", top: trip ? 152 : 112, left: 16, zIndex: 20, display: "flex", gap: 6 }}>
          {days.map((d, i) => (
            <button key={d.id} onClick={() => { setDayIdx(i); setSelectedIdx(0); setSelectedPlace(null); }} style={{ height: 26, padding: "0 10px", borderRadius: 999, border: "none", background: i === dayIdx ? "var(--hh-copper-600)" : "rgba(250,247,241,0.82)", backdropFilter: "blur(8px)", cursor: "pointer", fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: i === dayIdx ? "#FAF7F1" : "var(--hh-stone-500)", letterSpacing: "0.08em" }}>
              D{pad2(d.day_number)}
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom: selected place info card ── */}
      {selectedPlace && view === "map" && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "0 16px 20px", background: "var(--hh-linen-100)", borderTop: "0.5px solid var(--hh-linen-300)" }}>
          <div style={{ background: "var(--hh-linen-50)", borderRadius: 20, border: "0.5px solid var(--hh-linen-300)", boxShadow: "0 2px 12px rgba(26,22,17,0.08)", padding: "16px 16px 18px", position: "relative", marginTop: 12 }}>
            <button onClick={() => setSelectedPlace(null)} style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: 999, background: "var(--hh-linen-200)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <X size={13} color="var(--hh-stone-500)" strokeWidth={2}/>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              {(() => { const Icon = CATEGORY_ICON[selectedPlace.category] ?? Gem; const color = CATEGORY_COLOR[selectedPlace.category] ?? "#B5A992"; return (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                  <Icon size={16} color={color} strokeWidth={1.5}/>
                </div>
              ); })()}
              <div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>
                  {CATEGORY_LABEL[selectedPlace.category] ?? selectedPlace.category}
                  {selectedPlace.price_level ? ` · ${PRICE_MARK[selectedPlace.price_level]}` : ""}
                  {selectedPlace.rating ? ` · ★ ${selectedPlace.rating}` : ""}
                </div>
                <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, lineHeight: 1.1, color: "var(--hh-ink-900)", letterSpacing: "-0.01em" }}>
                  {selectedPlace.name}
                </div>
              </div>
            </div>

            {selectedPlace.description && (
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, lineHeight: 1.55, color: "var(--hh-ink-700)", marginBottom: 10 }}>
                {selectedPlace.description}
              </div>
            )}

            {selectedPlace.address && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={11} color="var(--hh-stone-400)" strokeWidth={1.5}/>
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "var(--hh-stone-500)" }}>{selectedPlace.address}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom: trip activity cards ── */}
      {!selectedPlace && trip && view === "map" && (
        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, zIndex: 20 }}>
          <div ref={cardsRef} style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 20px", scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
            {validActivities.map((act, i) => {
              const cat   = act.places?.category ?? "";
              const Icon  = CATEGORY_ICON[cat] ?? Gem;
              const color = CATEGORY_COLOR[cat] ?? "#B5A992";
              const active = i === selectedIdx;
              return (
                <button key={act.id} onClick={() => setSelectedIdx(i)} style={{ flex: "0 0 auto", width: 200, minWidth: 200, padding: "14px 16px", borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: `0.5px solid ${active ? "transparent" : "var(--hh-linen-300)"}`, boxShadow: active ? "0 2px 12px rgba(26,22,17,0.20)" : "none", cursor: "pointer", textAlign: "left", scrollSnapAlign: "center", transition: "background 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(250,247,241,0.10)" : "var(--hh-linen-200)", display: "grid", placeItems: "center" }}>
                      <Icon size={14} color={active ? "#FAF7F1" : color} strokeWidth={1.6}/>
                    </div>
                    <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 700, color: active ? "rgba(250,247,241,0.35)" : "var(--hh-stone-300)", letterSpacing: "0.06em" }}>{pad2(i + 1)}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 16, lineHeight: 1.15, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 4, letterSpacing: "-0.01em" }}>{act.places?.name ?? "—"}</div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: active ? "rgba(250,247,241,0.45)" : "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat}</div>
                </button>
              );
            })}
            {validActivities.length === 0 && (
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "rgba(26,22,17,0.4)", padding: "16px 4px" }}>No stops on this day.</div>
            )}
            <div style={{ flex: "0 0 8px" }}/>
          </div>
        </div>
      )}

      {/* ── Bottom: no trip CTA ── */}
      {!trip && !selectedPlace && view === "map" && (
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 20 }}>
          <div style={{ background: "rgba(250,247,241,0.94)", backdropFilter: "blur(12px)", borderRadius: 20, border: "0.5px solid rgba(180,165,145,0.3)", boxShadow: "0 4px 20px rgba(26,22,17,0.12)", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, color: "var(--hh-ink-900)", marginBottom: 2 }}>Explore Helsinki</div>
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "var(--hh-stone-400)" }}>{allPlaces.length} places on the map</div>
            </div>
            <a href="/onboarding" style={{ height: 36, padding: "0 16px", borderRadius: 999, background: "var(--hh-ink-900)", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", textDecoration: "none" }}>Plan a trip →</a>
          </div>
        </div>
      )}
    </div>
  );
}
