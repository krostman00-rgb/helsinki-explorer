"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Coffee, Utensils, Flame, Landmark, TreePine, Building2, Gem, Moon, ShoppingBag, Users, History, CalendarDays,
  Star, MapPin, X, CheckCircle2, LocateFixed,
} from "lucide-react";
import { markActivityDone } from "@/lib/gamification";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity, Place } from "@/types/database.types";
import type { MapActivity, MapPlace, AccommodationMarker, UserLocation, TripMapViewHandle } from "@/components/TripMapView";
import type { TransitResult } from "@/lib/transit";
import { TransitConnector } from "@/components/TransitConnector";

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
  places: Pick<Place, "name" | "category" | "lat" | "lng" | "tags"> | null;
}
interface DayWithActivities extends TripDay {
  trip_activities: ActivityWithPlace[];
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

// ── Transit fetch helper ───────────────────────────────────────
async function fetchTransitLeg(
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
): Promise<TransitResult | null> {
  try {
    const p = new URLSearchParams({
      fromLat: String(fromLat), fromLng: String(fromLng),
      toLat:   String(toLat),   toLng:   String(toLng),
    });
    const res = await fetch(`/api/route-between?${p}`);
    if (!res.ok) return null;
    return await res.json() as TransitResult;
  } catch { return null; }
}

export default function MapPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [trip, setTrip]           = useState<Trip | null>(null);
  const [days, setDays]           = useState<DayWithActivities[]>([]);
  const [dayIdx, setDayIdx]       = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  // view state removed — always map
  // tripLoading: true while we're waiting for auth + trip data (controls bottom strip skeleton)
  const [tripLoading, setTripLoading] = useState(true);

  const [allPlaces, setAllPlaces]         = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [filterCat, setFilterCat]         = useState("all");
  const [toast, setToast]                 = useState<string | null>(null);
  const [transitLegs, setTransitLegs]     = useState<(TransitResult | null)[]>([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [accommodation, setAccommodation] = useState<AccommodationMarker | null>(null);
  const [userLocation, setUserLocation]   = useState<UserLocation | null>(null);
  const [locating, setLocating]           = useState(false);
  const watchIdRef    = useRef<number | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapViewRef    = useRef<TripMapViewHandle>(null);

  // Clean up watchPosition on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (watchTimerRef.current) clearTimeout(watchTimerRef.current);
  }, []);

  const cardsRef  = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const sb = createClient();

    // Always fetch all places
    sb.from("places").select("id, name, category, lat, lng, description, address, rating, price_level")
      .then(({ data }) => {
        if (data) setAllPlaces(data as MapPlace[]);
      });

    // Fetch trip only if user is available
    if (!user) {
      if (!authLoading) setTripLoading(false);
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

      if (!tripData) { setTripLoading(false); return; }
      setTrip(tripData);

      // Set accommodation marker if available
      if (tripData.accommodation_lat && tripData.accommodation_lng) {
        setAccommodation({
          name: tripData.accommodation_name ?? "Your stay",
          lat: tripData.accommodation_lat,
          lng: tripData.accommodation_lng,
        });
      }

      const { data: daysData } = await sb
        .from("trip_days")
        .select("*, trip_activities(*, places(name, category, lat, lng, tags))")
        .eq("trip_id", tripData.id)
        .order("day_number", { ascending: true });
      setDays((daysData as unknown as DayWithActivities[]) ?? []);
      setTripLoading(false);
    })();
  }, [user, authLoading]);

  useEffect(() => {
    cardElsRef.current[selectedIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIdx]);

  const currentDay = days[dayIdx];
  const activities: ActivityWithPlace[] = currentDay?.trip_activities ?? [];
  const validActivities = activities.filter(a => a.places?.lat && a.places?.lng);

  const filteredPlaces = useMemo(
    () => filterCat === "all" ? allPlaces : allPlaces.filter(p => p.category === filterCat),
    [allPlaces, filterCat]
  );

  // Key that changes when the activity list or coordinates change
  const activitiesKey = useMemo(
    () => validActivities.map(a => `${a.id}:${a.places?.lat},${a.places?.lng}`).join("|"),
    [validActivities]
  );

  // CRITICAL: stable reference so TripMapView's effects don't refire on every render.
  // Without this, the activities/flyTo effects in TripMapView re-run on every state
  // change (incl. each watchPosition tick), repeatedly calling fitBounds() to the
  // trip area and overriding the user-location flyTo.
  const mapActivities = useMemo<MapActivity[]>(
    () => validActivities.map(a => ({
      id: a.id,
      completed: a.completed ?? false,
      places: a.places ? { category: a.places.category, lat: a.places.lat, lng: a.places.lng } : null,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activitiesKey],
  );

  useEffect(() => {
    if (validActivities.length < 2) { setTransitLegs([]); return; }
    setTransitLoading(true);
    const pairs = validActivities.slice(0, -1).map((a, i) => ({
      fromLat: a.places!.lat, fromLng: a.places!.lng,
      toLat:   validActivities[i + 1].places!.lat,
      toLng:   validActivities[i + 1].places!.lng,
    }));
    Promise.all(pairs.map(p => fetchTransitLeg(p.fromLat, p.fromLng, p.toLat, p.toLng)))
      .then(results => { setTransitLegs(results); setTransitLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesKey]);

  const handleMarkerClick = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setSelectedPlace(null);
  }, []);

  const handlePlaceClick = useCallback((place: MapPlace) => {
    setSelectedPlace(place);
    setSelectedIdx(-1);
  }, []);

  const handleMarkDone = useCallback(async (act: ActivityWithPlace) => {
    if (!user || !trip || act.completed) return;
    const result = await markActivityDone(
      user.id,
      act.id,
      act.places?.name ?? "",
      act.places?.category ?? "",
      act.places?.tags ?? [],
      trip.id,
    );
    // Update local state optimistically
    setDays(prev => prev.map(d => ({
      ...d,
      trip_activities: d.trip_activities.map(a =>
        a.id === act.id ? { ...a, completed: true } : a
      ),
    })));
    const msg = result.newAchievements.length > 0
      ? `+${result.pointsEarned} pts · ${result.newAchievements[0].icon} ${result.newAchievements[0].title} unlocked!`
      : `+${result.pointsEarned} pts`;
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, [user, trip]);

  // No blocking loading screen — map renders immediately, trip data fills in async

  const dayName = currentDay?.date
    ? (DAY_NAMES[new Date(currentDay.date + "T12:00:00").getDay()] ?? "—")
    : "—";
  const dayNumber  = currentDay ? pad2(currentDay.day_number) : "01";
  const stopCount  = validActivities.length;

  return (
    <div className="hh-page-enter" style={{ position: "relative", width: "100%", height: "calc(100dvh - 68px)", overflow: "hidden" }}>

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: 100, whiteSpace: "nowrap", background: "var(--hh-ink-900)", color: "#FAF7F1", fontFamily: "var(--font-geist-mono)", fontSize: 11, letterSpacing: "0.08em", padding: "10px 18px", borderRadius: 999, boxShadow: "0 4px 20px rgba(26,22,17,0.25)", pointerEvents: "none", animation: "fadeIn 0.2s ease" }}>
          {toast}
        </div>
      )}

      {/* ── Full-screen map ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <TripMapView
          ref={mapViewRef}
          activities={mapActivities}
          selectedIdx={selectedIdx}
          onMarkerClick={handleMarkerClick}
          accommodation={accommodation}
          userLocation={userLocation}
        />
      </div>

      {/* ── Top bar — day switcher (left) + GPS (right) ── */}
      <div style={{ position: "absolute", top: 16, left: 16, right: 16, zIndex: 20, display: "flex", gap: 8, alignItems: "center" }}>

        {/* Day switcher — left side */}
        {trip && days.length > 0 ? (
          <div style={{ flex: 1, display: "flex", gap: 5, alignItems: "center", flexWrap: "nowrap", overflow: "hidden" }}>
            {days.length === 1 ? (
              /* Single day: show context pill */
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 16px", borderRadius: 999, background: "rgba(250,247,241,0.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "0.5px solid rgba(180,165,145,0.4)", boxShadow: "0 2px 16px rgba(26,22,17,0.10)" }}>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "#4A3F33", letterSpacing: "0.08em" }}>
                  {dayName.toUpperCase()} · {pad2(stopCount)} stops
                </span>
              </div>
            ) : (
              /* Multi-day: show Day 1, Day 2… buttons */
              days.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => { setDayIdx(i); setSelectedIdx(0); setSelectedPlace(null); }}
                  style={{
                    height: 44, padding: "0 14px", borderRadius: 999, border: "none",
                    background: i === dayIdx ? "var(--hh-ink-900)" : "rgba(250,247,241,0.94)",
                    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                    boxShadow: "0 2px 16px rgba(26,22,17,0.10)",
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 500,
                    color: i === dayIdx ? "#FAF7F1" : "#4A3F33",
                    letterSpacing: "0.01em",
                    transition: "background 0.18s, color 0.18s",
                    flex: "0 0 auto",
                  }}
                >
                  Day {d.day_number}
                </button>
              ))
            )}
          </div>
        ) : (
          <div style={{ flex: 1 }}/>
        )}

        {/* GPS locate button */}
        <button
          onClick={() => {
            if (!navigator.geolocation) {
              setToast("Sijaintipalvelut eivät ole käytettävissä");
              setTimeout(() => setToast(null), 3000);
              return;
            }
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
            }
            if (watchTimerRef.current) {
              clearTimeout(watchTimerRef.current);
              watchTimerRef.current = null;
            }
            setLocating(true);
            let best: { lat: number; lng: number; accuracy: number } | null = null;

            const finish = (reason: "accurate" | "timeout" | "error", errMsg?: string) => {
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              if (watchTimerRef.current) {
                clearTimeout(watchTimerRef.current);
                watchTimerRef.current = null;
              }
              setLocating(false);
              if (reason === "error") {
                setToast(errMsg ?? "Sijainnin haku epäonnistui");
                setTimeout(() => setToast(null), 4000);
                return;
              }
              if (best) {
                setUserLocation({ lat: best.lat, lng: best.lng });
                mapViewRef.current?.flyToLocation(best.lat, best.lng, 15.5);
              }
              // No toast on success — the map flying is enough feedback
            };

            watchTimerRef.current = setTimeout(() => finish("timeout"), 12000);
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => {
                const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                if (!best || accuracy < best.accuracy) {
                  best = { lat, lng, accuracy };
                  setUserLocation({ lat, lng });
                  mapViewRef.current?.flyToLocation(lat, lng, 15.5);
                }
                if (accuracy <= 100) finish("accurate");
              },
              (err) => {
                const msg =
                  err.code === 1 ? "Salli sijaintilupa selaimen asetuksista" :
                  err.code === 2 ? "Sijaintia ei voitu määrittää" :
                  "Sijainnin haku aikakatkaistiin";
                finish("error", msg);
              },
              { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
            );
          }}
          style={{
            width: 44, height: 44, borderRadius: 999, border: "none",
            background: userLocation ? "var(--hh-ink-900)" : "#FAF7F1",
            boxShadow: "0 2px 16px rgba(26,22,17,0.18)",
            display: "grid", placeItems: "center", cursor: "pointer",
            flex: "0 0 auto",
            opacity: locating ? 0.6 : 1,
            transition: "opacity 0.2s, background 0.2s",
          }}
          aria-label="Locate me"
        >
          <LocateFixed size={18} color={userLocation ? "#FAF7F1" : "#4A3F33"} strokeWidth={1.8}/>
        </button>
      </div>

      {/* ── Category filter chips ── */}
      <div style={{ position: "absolute", top: 72, left: 0, right: 0, zIndex: 20, display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", padding: "0 16px" }}>
        {FILTER_CATEGORIES.map(({ k, label }) => (
          <button key={k} onClick={() => setFilterCat(k)} style={{ flex: "0 0 auto", height: 28, padding: "0 12px", borderRadius: 999, border: "none", background: filterCat === k ? "var(--hh-ink-900)" : "rgba(250,247,241,0.88)", backdropFilter: "blur(8px)", fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: filterCat === k ? 600 : 400, color: filterCat === k ? "#FAF7F1" : "var(--hh-stone-600)", cursor: "pointer", boxShadow: "0 1px 8px rgba(26,22,17,0.10)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Bottom: selected place info card ── */}
      {selectedPlace && (
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
      {!selectedPlace && trip && (
        <div style={{ position: "absolute", bottom: 20, left: 0, right: 0, zIndex: 20 }}>
          <div ref={cardsRef} style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", padding: "0 20px", scrollbarWidth: "none", scrollSnapType: "x mandatory" }}>
            {validActivities.map((act, i) => {
              const cat   = act.places?.category ?? "";
              const Icon  = CATEGORY_ICON[cat] ?? Gem;
              const color = CATEGORY_COLOR[cat] ?? "#B5A992";
              const active = i === selectedIdx;
              return (
                <div key={act.id} style={{ display: "flex", alignItems: "center", flex: "0 0 auto" }}>
                  <button
                    ref={el => { cardElsRef.current[i] = el; }}
                    onClick={() => setSelectedIdx(i)}
                    style={{ flex: "0 0 auto", width: 200, minWidth: 200, padding: "14px 16px", borderRadius: 16, background: active ? "var(--hh-ink-900)" : act.completed ? "rgba(63,90,69,0.08)" : "var(--hh-linen-50)", border: `0.5px solid ${active ? "transparent" : act.completed ? "rgba(63,90,69,0.25)" : "var(--hh-linen-300)"}`, boxShadow: active ? "0 2px 12px rgba(26,22,17,0.20)" : "none", cursor: "pointer", textAlign: "left", scrollSnapAlign: "center", transition: "background 0.2s" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: active ? "rgba(250,247,241,0.10)" : "var(--hh-linen-200)", display: "grid", placeItems: "center" }}>
                        <Icon size={14} color={active ? "#FAF7F1" : color} strokeWidth={1.6}/>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {act.completed
                          ? <CheckCircle2 size={14} color={active ? "rgba(250,247,241,0.6)" : "#3F5A45"} strokeWidth={2}/>
                          : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkDone(act); }}
                              style={{ width: 26, height: 26, borderRadius: 999, border: `1.5px solid ${active ? "rgba(250,247,241,0.25)" : "var(--hh-linen-300)"}`, background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}
                            >
                              <CheckCircle2 size={12} color={active ? "rgba(250,247,241,0.4)" : "var(--hh-stone-400)"} strokeWidth={1.8}/>
                            </button>
                          )
                        }
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 16, lineHeight: 1.15, color: active ? "#FAF7F1" : "var(--hh-ink-900)", marginBottom: 4, letterSpacing: "-0.01em" }}>{act.places?.name ?? "—"}</div>
                    <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: active ? "rgba(250,247,241,0.45)" : "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{cat}</div>
                  </button>
                  {/* Transit connector to next stop */}
                  {i < validActivities.length - 1 && (
                    <TransitConnector
                      transit={transitLegs[i] ?? null}
                      loading={transitLoading && !transitLegs[i]}
                    />
                  )}
                </div>
              );
            })}
            {validActivities.length === 0 && (
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "rgba(26,22,17,0.4)", padding: "16px 4px" }}>No stops on this day.</div>
            )}
            <div style={{ flex: "0 0 20px" }}/>
          </div>
        </div>
      )}

      {/* ── Bottom: skeleton while trip data loads ── */}
      {tripLoading && (
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 20 }}>
          <div style={{ background: "rgba(250,247,241,0.82)", backdropFilter: "blur(12px)", borderRadius: 20, height: 72, animation: "hh-skeleton-pulse 1.4s ease-in-out infinite" }}/>
        </div>
      )}

      {/* ── Bottom: no trip CTA ── */}
      {!tripLoading && !trip && !selectedPlace && (
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
