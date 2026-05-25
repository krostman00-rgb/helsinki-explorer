"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Coffee, Utensils, Flame, Landmark, TreePine, Building2,
  Gem, Moon, Footprints, TramFront, Ship, BusFront, TrainFront,
  ChevronLeft, Plus, CircleCheck, Search, GripVertical,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult, DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity, Place, Json } from "@/types/database.types";

interface ActivityWithPlace extends TripActivity {
  places: Pick<Place, "name" | "category" | "address" | "description" | "lat" | "lng" | "image_url" | "tags" | "price_level" | "rating" | "website" | "opening_hours"> | null;
}
interface DayWithActivities extends TripDay {
  trip_activities: ActivityWithPlace[];
}

const TIME_SLOTS = ["09:30", "12:00", "14:00", "17:30", "20:00"];
const DAY_NAMES   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_ABBR    = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

const CATEGORY_LABEL: Record<string, string> = {
  food: "LUNCH", cafe: "CAFÉ", sauna: "SAUNA", nature: "ISLAND",
  museums: "MUSEUM", history: "HISTORY", arch: "ARCH", design: "DESIGN",
  shop: "SHOP", night: "NIGHT", events: "EVENT", family: "FAMILY",
};
const CATEGORY_COLOR: Record<string, string> = {
  food: "#B65A37", cafe: "#B65A37", shop: "#B65A37",
  sauna: "#3F5A45", nature: "#3F5A45", family: "#3F5A45",
  museums: "#133A5B", history: "#133A5B", arch: "#133A5B",
  design: "#1A1611", night: "#C99544", events: "#C99544",
};

const PRICE_MARK: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€" };

// ── Opening hours helpers ──────────────────────────────────────
function getTodayHours(opening_hours: Json | null): { open: string; close: string } | null {
  if (!opening_hours || typeof opening_hours !== "object" || Array.isArray(opening_hours)) return null;
  const h = opening_hours as Record<string, unknown>;
  const day = new Date().getDay();
  const shortK = ["sun","mon","tue","wed","thu","fri","sat"];
  const longK  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  for (const key of [shortK[day], longK[day], String(day), String(day + 1)]) {
    if (!key) continue;
    const val = h[key];
    if (!val) continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      const v = val as Record<string, unknown>;
      if (typeof v.open === "string" && typeof v.close === "string") return { open: v.open, close: v.close };
    }
    if (typeof val === "string") {
      const m = val.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
      if (m && m[1] && m[2]) return { open: m[1], close: m[2] };
    }
  }
  return null;
}

function isOpenNow(hours: { open: string; close: string }): boolean {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const parse = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
  return nowMin >= parse(hours.open) && nowMin < parse(hours.close);
}

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  cafe:    Coffee,
  food:    Utensils,
  sauna:   Flame,
  museums: Landmark,
  history: Landmark,
  nature:  TreePine,
  family:  TreePine,
  arch:    Building2,
  design:  Gem,
  shop:    Gem,
  night:   Moon,
  events:  Gem,
};

function CategoryIcon({ category }: { category: string }) {
  const color = CATEGORY_COLOR[category] ?? "#B5A992";
  const Icon  = CATEGORY_ICON[category] ?? Gem;
  return (
    <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
      <Icon size={19} color={color} strokeWidth={1.4}/>
    </div>
  );
}

function isNow(index: number): boolean {
  const slot = TIME_SLOTS[index];
  if (!slot) return false;
  const [h, m] = slot.split(":").map(Number);
  const now = new Date();
  const slotMin = h * 60 + (m ?? 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= slotMin && nowMin < slotMin + 110;
}

function ActivityCard({ activity, index, onToggle, dragHandleProps, onInfoClick }: {
  activity: ActivityWithPlace;
  index: number;
  onToggle: (id: string, completed: boolean) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onInfoClick?: () => void;
}) {
  const time     = TIME_SLOTS[index] ?? "";
  const cat      = activity.places?.category ?? "";
  const catLabel = CATEGORY_LABEL[cat] ?? cat.toUpperCase();
  const catColor = CATEGORY_COLOR[cat] ?? "#B5A992";
  const now      = isNow(index);
  const mins     = activity.duration_minutes ?? 0;
  const duration = mins >= 60
    ? `${Math.floor(mins / 60)}H${mins % 60 ? ` ${mins % 60}M` : ""}`
    : mins ? `${mins} MIN` : "";

  return (
    <div
      onClick={onInfoClick}
      style={{
        borderRadius: 18,
        background: now ? "var(--hh-ink-900)" : "var(--hh-linen-50)",
        border: now ? "none" : "0.5px solid var(--hh-linen-300)",
        padding: "14px 16px 16px",
        opacity: activity.completed ? 0.55 : 1,
        transition: "opacity 0.2s",
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        cursor: onInfoClick ? "pointer" : "default",
      }}
    >
      {/* drag handle */}
      <div
        {...(dragHandleProps ?? {})}
        style={{ display: "flex", alignItems: "center", paddingRight: 8, paddingLeft: 2, cursor: dragHandleProps ? "grab" : "default", flex: "0 0 auto", touchAction: "none" }}
      >
        <GripVertical size={15} color={now ? "rgba(250,247,241,0.25)" : "var(--hh-linen-300)"} strokeWidth={1.4}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
      {/* top meta row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12.5, fontWeight: 600, color: now ? "var(--hh-linen-50)" : "var(--hh-ink-900)", letterSpacing: "0.01em" }}>{time}</span>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: catColor }}/>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: now ? "rgba(250,247,241,0.55)" : "var(--hh-stone-500)", letterSpacing: "0.1em" }}>{catLabel}</span>
          {duration && <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: now ? "rgba(250,247,241,0.4)" : "var(--hh-stone-400)" }}>· {duration}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {now && !activity.completed && (
            <div style={{ padding: "2px 9px", borderRadius: 999, background: "var(--hh-copper-600)", fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "#FAF7F1", letterSpacing: "0.1em" }}>
              NOW
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); onToggle(activity.id, !activity.completed); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            {activity.completed ? (
              <>
                <CircleCheck size={16} color={now ? "#FAF7F1" : "#3F5A45"} strokeWidth={1.5}/>
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: now ? "rgba(250,247,241,0.7)" : "#3F5A45" }}>visited</span>
              </>
            ) : (
              <div style={{ width: 18, height: 18, borderRadius: 999, border: `1.5px solid ${now ? "rgba(250,247,241,0.3)" : "var(--hh-linen-300)"}` }}/>
            )}
          </button>
        </div>
      </div>

      {/* content */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <CategoryIcon category={cat}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: 22,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: now ? "var(--hh-linen-50)" : "var(--hh-ink-900)",
            textDecoration: activity.completed ? "line-through" : "none",
            marginBottom: 3,
          }}>
            {activity.title}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, color: now ? "rgba(250,247,241,0.55)" : "var(--hh-stone-500)" }}>
            {activity.description ?? activity.places?.address ?? ""}
          </div>
          {/* Opening hours today */}
          {(() => {
            const hours = getTodayHours(activity.places?.opening_hours ?? null);
            if (!hours) return null;
            const open = isOpenNow(hours);
            // Check if planned time is before opening
            const slot = TIME_SLOTS[index];
            let earlyWarning = false;
            if (slot) {
              const [sh, sm] = slot.split(":").map(Number);
              const [oh, om] = hours.open.split(":").map(Number);
              earlyWarning = (sh ?? 0) * 60 + (sm ?? 0) < (oh ?? 0) * 60 + (om ?? 0);
            }
            if (earlyWarning) {
              return (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, color: now ? "rgba(201,149,68,0.9)" : "var(--hh-amber-500)" }}>⚠ Opens at {hours.open} – consider arriving later</span>
                </div>
              );
            }
            return (
              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: 999, background: open ? (now ? "rgba(110,138,110,0.9)" : "#3F5A45") : (now ? "rgba(182,90,55,0.8)" : "#B65A37"), flex: "0 0 auto" }}/>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: now ? "rgba(250,247,241,0.45)" : "var(--hh-stone-400)", letterSpacing: "0.04em" }}>
                  {open ? `Open until ${hours.close}` : `Opens ${hours.open}`}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
      </div>{/* end inner flex content */}
    </div>
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type TransitMode = "walk" | "tram" | "ferry" | "bus" | "subway";

interface RouteLeg {
  mode: TransitMode;
  durationMin: number;
  line?: string;
  fromStop?: string;
  toStop?: string;
}
interface RouteInfo { totalMin: number; legs: RouteLeg[] }

const MODE_ICON: Record<string, TransitMode> = {
  WALK: "walk", TRAM: "tram", FERRY: "ferry", BUS: "bus", SUBWAY: "subway",
};

function haversineRoute(
  fromLat: number, fromLng: number, toLat: number, toLng: number,
): RouteInfo {
  const urbanKm = haversineKm(fromLat, fromLng, toLat, toLng) * 1.3;
  const totalMin = urbanKm > 1
    ? Math.round(urbanKm / 15 * 60)
    : Math.round(urbanKm / 5 * 60);
  return {
    totalMin,
    legs: [{ mode: urbanKm > 1 ? "tram" : "walk", durationMin: totalMin }],
  };
}

function Connector({ from, to, fromIndex }: { from: ActivityWithPlace; to: ActivityWithPlace; fromIndex: number }) {
  const fromLat = from.places?.lat;
  const fromLng = from.places?.lng;
  const toLat   = to.places?.lat;
  const toLng   = to.places?.lng;

  // Approximate departure time = end of the "from" activity slot
  const departureTime = (() => {
    const slot = TIME_SLOTS[fromIndex] ?? "09:30";
    const [h, m] = slot.split(":").map(Number);
    const durMin = from.duration_minutes ?? 60;
    const totalMin = (h ?? 9) * 60 + (m ?? 0) + durMin;
    const dh = String(Math.floor(totalMin / 60) % 24).padStart(2, "0");
    const dm = String(totalMin % 60).padStart(2, "0");
    return `${dh}:${dm}:00`;
  })();

  // Immediate estimate while real data loads
  const estimate = useMemo<RouteInfo | null>(() => {
    if (to.places?.name === "Suomenlinna" || from.places?.name === "Suomenlinna") {
      return { totalMin: 15, legs: [{ mode: "ferry", durationMin: 15, fromStop: "Kauppatori", toStop: "Suomenlinna" }] };
    }
    if (fromLat && fromLng && toLat && toLng) {
      return haversineRoute(fromLat, fromLng, toLat, toLng);
    }
    return null;
  }, [fromLat, fromLng, toLat, toLng, from.places?.name, to.places?.name]);

  const [realRoute, setRealRoute] = useState<RouteInfo | null>(null);

  useEffect(() => {
    // Ferry to Suomenlinna is hardcoded — no API needed
    if (to.places?.name === "Suomenlinna" || from.places?.name === "Suomenlinna") return;
    if (!fromLat || !fromLng || !toLat || !toLng) return;

    const url = `/api/route-between?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}&time=${encodeURIComponent(departureTime)}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.error || !data.legs) return;
        setRealRoute({
          totalMin: data.totalMin,
          legs: (data.legs as Array<{ mode: string; durationMin: number; line: string | null; fromStop: string | null; toStop: string | null }>).map(l => ({
            mode: MODE_ICON[l.mode] ?? "tram",
            durationMin: l.durationMin,
            line: l.line ?? undefined,
            fromStop: l.fromStop ?? undefined,
            toStop: l.toStop ?? undefined,
          })),
        });
      })
      .catch(() => {}); // network error → keep estimate
  }, [fromLat, fromLng, toLat, toLng, from.places?.name, to.places?.name, departureTime]);

  const display = realRoute ?? estimate;

  const modeIcon: Record<TransitMode, React.ReactNode> = {
    walk:   <Footprints size={13} color="var(--hh-stone-500)" strokeWidth={1.4}/>,
    tram:   <TramFront  size={13} color="var(--hh-stone-500)" strokeWidth={1.4}/>,
    ferry:  <Ship       size={13} color="var(--hh-stone-500)" strokeWidth={1.4}/>,
    bus:    <BusFront   size={13} color="var(--hh-stone-500)" strokeWidth={1.4}/>,
    subway: <TrainFront size={13} color="var(--hh-stone-500)" strokeWidth={1.4}/>,
  };

  if (!display) return null;

  const transitLegs = display.legs.filter(l => l.mode !== "walk");
  const isAllWalk   = transitLegs.length === 0;

  // "Tram 10 + Tram 3" or "Ferry" etc.
  const modeSummary = isAllWalk
    ? `${display.totalMin} min walk`
    : transitLegs.map(l => `${l.mode.charAt(0).toUpperCase() + l.mode.slice(1)}${l.line ? ` ${l.line}` : ""}`).join("  +  ") + `  ·  ${display.totalMin} min`;

  // Stop chain: board stop of first transit → all alight stops
  const stopChain: string[] = [];
  for (const leg of transitLegs) {
    if (stopChain.length === 0 && leg.fromStop) stopChain.push(leg.fromStop);
    if (leg.toStop) stopChain.push(leg.toStop);
  }

  // Icon of first transit leg (or walk)
  const primaryIcon = isAllWalk ? modeIcon.walk : modeIcon[transitLegs[0].mode];

  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "5px 8px 5px" }}>
      {/* vertical line */}
      <div style={{ width: 1.5, alignSelf: "stretch", background: "var(--hh-linen-300)", borderRadius: 1, marginLeft: 30, marginRight: 10, flex: "0 0 auto", minHeight: 20 }}/>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {/* single summary chip */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", borderRadius: 999, padding: "5px 12px", alignSelf: "flex-start" }}>
          {primaryIcon}
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-stone-500)", letterSpacing: "0.06em" }}>
            {modeSummary}
          </span>
        </div>

        {/* stop chain — only when there are transit legs */}
        {stopChain.length >= 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 2 }}>
            {stopChain.map((stop, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                  {stop}
                </span>
                {i < stopChain.length - 1 && (
                  <ChevronLeft size={10} color="var(--hh-stone-400)" strokeWidth={1.4} style={{ flex: "0 0 auto", transform: "rotate(180deg)", opacity: 0.5 }}/>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DaySwitcher({ days, activeIdx, onSelect }: {
  days: DayWithActivities[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const today = new Date();
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "0 20px", scrollbarWidth: "none" }}>
      {days.map((day, i) => {
        const active = i === activeIdx;
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const completed = day.trip_activities.filter(a => a.completed).length;
        const total = day.trip_activities.length;
        return (
          <button key={day.id} onClick={() => onSelect(i)} style={{ flex: "0 0 auto", width: 70, padding: "10px 0 12px", borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: active ? "none" : "0.5px solid var(--hh-linen-300)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, letterSpacing: "0.1em", color: active ? "rgba(250,247,241,0.45)" : "var(--hh-stone-400)" }}>{DAY_ABBR[d.getDay()]}</div>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 0.9, color: active ? "var(--hh-linen-50)" : "var(--hh-ink-900)", letterSpacing: "-0.02em" }}>{d.getDate()}</div>
            <div style={{ display: "flex", gap: 2.5, marginTop: 3 }}>
              {Array.from({ length: Math.min(total, 6) }, (_, j) => (
                <div key={j} style={{ width: 4, height: 4, borderRadius: 999, background: j < completed ? "var(--hh-copper-600)" : active ? "rgba(250,247,241,0.2)" : "var(--hh-linen-300)" }}/>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AddActivitySheet({ tripDayId, orderIndex, existingPlaceIds, onAdd, onClose }: {
  tripDayId: string;
  orderIndex: number;
  existingPlaceIds: string[];
  onAdd: (activity: ActivityWithPlace) => void;
  onClose: () => void;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [search, setSearch]   = useState("");
  const [adding, setAdding]   = useState<string | null>(null);

  useEffect(() => {
    createClient().from("places").select("*").order("name").then(({ data }) => setPlaces(data ?? []));
  }, []);

  const filtered = places
    .filter(p => !existingPlaceIds.includes(p.id))
    .filter(p =>
      search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (CATEGORY_LABEL[p.category] ?? p.category).toLowerCase().includes(search.toLowerCase())
    );

  const addPlace = async (place: Place) => {
    if (adding) return;
    setAdding(place.id);
    const { data, error } = await createClient()
      .from("trip_activities")
      .insert({
        trip_day_id:      tripDayId,
        place_id:         place.id,
        title:            place.name,
        description:      place.description ?? undefined,
        order_index:      orderIndex,
        duration_minutes: 90,
        completed:        false,
      })
      .select("*, places(name, category, address, description, lat, lng)")
      .single();
    if (!error && data) onAdd(data as unknown as ActivityWithPlace);
    setAdding(null);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.5)", zIndex: 40, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}/>
      <div className="hh-sheet-enter" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--hh-linen-50)", borderRadius: "24px 24px 0 0", maxHeight: "82dvh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(10,15,25,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--hh-linen-300)" }}/>
        </div>
        <div style={{ padding: "8px 20px 14px", borderBottom: "0.5px solid var(--hh-linen-300)" }}>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em", color: "var(--hh-ink-900)", marginBottom: 12 }}>
            Add a place
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} color="var(--hh-stone-400)" strokeWidth={1.4} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}/>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search places…"
              style={{ width: "100%", boxSizing: "border-box", height: 42, borderRadius: 12, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-100)", padding: "0 14px 0 36px", fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-ink-900)", outline: "none" }}
            />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0 40px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-400)", letterSpacing: "0.1em" }}>
              No places found.
            </div>
          ) : filtered.map(place => (
            <button
              key={place.id}
              onClick={() => addPlace(place)}
              disabled={!!adding}
              style={{ width: "100%", padding: "13px 20px", background: adding === place.id ? "var(--hh-linen-200)" : "none", border: "none", borderBottom: "0.5px solid var(--hh-linen-200)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 999, background: CATEGORY_COLOR[place.category] ?? "#B5A992", flex: "0 0 auto" }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 19, color: "var(--hh-ink-900)", lineHeight: 1.2 }}>{place.name}</div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 1 }}>
                  {CATEGORY_LABEL[place.category] ?? place.category}
                </div>
              </div>
              <Plus size={14} color="var(--hh-stone-400)" strokeWidth={1.6}/>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function AchievementToast({ icon, title, points }: { icon: string; title: string; points: number }) {
  return (
    <div className="hh-toast-enter" style={{ position: "fixed", top: 60, left: "50%", zIndex: 100, background: "var(--hh-ink-900)", color: "var(--hh-linen-50)", borderRadius: 20, padding: "14px 22px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 32px rgba(10,15,25,0.4)", whiteSpace: "nowrap" }}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(250,247,241,0.5)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 3 }}>Achievement unlocked</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 20, lineHeight: 1.1 }}>{title}</div>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-copper-500)", marginTop: 3 }}>+{points} pts</div>
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip]           = useState<Trip | null>(null);
  const [days, setDays]           = useState<DayWithActivities[]>([]);
  const [activeDayIdx, setActive] = useState(0);
  const [isLoading, setLoading]   = useState(true);
  const [showAddSheet, setShowAddSheet]         = useState(false);
  const [achievementToast, setAchievementToast] = useState<{ icon: string; title: string; points: number } | null>(null);

  const checkAchievements = useCallback((updatedDays: DayWithActivities[]) => {
    const all  = updatedDays.flatMap(d => d.trip_activities);
    const done = all.filter(a => a.completed);
    const storageKey = "hh_achievements";
    const unlocked = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
    const checks = [
      { key: "all_complete", icon: "❤",  title: "Helsinki sydämessä", points: 200, met: done.length === all.length && all.length > 0 },
      { key: "sauna_3",      icon: "♨",  title: "Saunamestari",       points: 150, met: done.filter(a => a.places?.category === "sauna").length >= 3 },
      { key: "cafe_5",       icon: "☕", title: "Aamukahvi",          points: 100, met: done.filter(a => a.places?.category === "cafe").length >= 5 },
      { key: "suomenlinna",  icon: "⛵", title: "Saaristoseilari",    points: 75,  met: done.some(a => a.title === "Suomenlinna") },
      { key: "food_3",       icon: "🐟", title: "Kalakukko",          points: 100, met: done.filter(a => a.places?.category === "food").length >= 3 },
      { key: "design_5",     icon: "◎",  title: "Designsisäänpiiri", points: 100, met: done.filter(a => ["design","arch","shop"].includes(a.places?.category ?? "")).length >= 5 },
    ];
    for (const c of checks) {
      if (c.met && !unlocked.includes(c.key)) {
        localStorage.setItem(storageKey, JSON.stringify([...unlocked, c.key]));
        setAchievementToast({ icon: c.icon, title: c.title, points: c.points });
        setTimeout(() => setAchievementToast(null), 3500);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("trips").select("*").eq("id", params.id).single(),
      supabase
        .from("trip_days")
        .select("*, trip_activities(*, places(name, category, address, description, lat, lng, image_url, tags, price_level, rating, website, opening_hours))")
        .eq("trip_id", params.id)
        .order("day_number"),
    ]).then(([tripRes, daysRes]) => {
      setTrip(tripRes.data);
      const loaded = (daysRes.data as unknown as DayWithActivities[]) ?? [];
      setDays(loaded.map(d => ({
        ...d,
        trip_activities: [...d.trip_activities].sort((a, b) => a.order_index - b.order_index),
      })));
      setLoading(false);
    });
  }, [params.id]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const src = result.source.index;
    const dst = result.destination.index;
    if (src === dst) return;

    let reordered: ActivityWithPlace[] = [];
    setDays(prev => prev.map((d, i) => {
      if (i !== activeDayIdx) return d;
      const acts = [...d.trip_activities];
      const [moved] = acts.splice(src, 1);
      acts.splice(dst, 0, moved);
      reordered = acts.map((a, j) => ({ ...a, order_index: j }));
      return { ...d, trip_activities: reordered };
    }));

    // Persist new order_index values
    const sb = createClient();
    await Promise.all(reordered.map(a =>
      sb.from("trip_activities").update({ order_index: a.order_index }).eq("id", a.id)
    ));
  }, [activeDayIdx]);

  const toggleActivity = useCallback(async (id: string, completed: boolean) => {
    let updated: DayWithActivities[] = [];
    setDays(prev => {
      updated = prev.map(d => ({
        ...d,
        trip_activities: d.trip_activities.map(a => a.id === id ? { ...a, completed } : a),
      }));
      return updated;
    });
    await createClient().from("trip_activities").update({ completed }).eq("id", id);
    if (completed) checkAchievements(updated);
  }, [checkAchievements]);

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", background: "var(--hh-linen-100)" }}>
      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading…</div>
    </div>
  );

  if (!trip) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", gap: 16 }}>
      <p style={{ color: "var(--hh-stone-500)" }}>Trip not found.</p>
      <Link href="/trips" style={{ color: "var(--hh-ink-900)", fontFamily: "var(--font-geist-sans)", fontSize: 14 }}>← Back</Link>
    </div>
  );

  const activeDay  = days[activeDayIdx];
  const activities = activeDay?.trip_activities ?? [];
  const visited    = activities.filter(a => a.completed).length;
  const totalHrs   = Math.round(activities.reduce((s, a) => s + (a.duration_minutes ?? 0), 0) / 60 * 10) / 10;

  const today = new Date();
  const dayDate = new Date(today);
  dayDate.setDate(today.getDate() + activeDayIdx);

  return (
    <div style={{ background: "var(--hh-linen-100)", minHeight: "calc(100dvh - 68px)" }}>

      {/* Header */}
      <div style={{ padding: "52px 20px 0", background: "var(--hh-linen-50)", borderBottom: "0.5px solid var(--hh-linen-300)" }}>
        <Link href="/trips" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "var(--hh-stone-400)", textDecoration: "none", marginBottom: 10 }}>
          <ChevronLeft size={14} strokeWidth={1.6}/>
          All trips
        </Link>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          {trip.title} · Day {activeDayIdx + 1} / {days.length}
        </div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 0.88, letterSpacing: "-0.025em", color: "var(--hh-ink-900)", marginBottom: 20 }}>
          {DAY_NAMES[dayDate.getDay()]}.
        </div>

        {/* Day switcher */}
        <DaySwitcher days={days} activeIdx={activeDayIdx} onSelect={setActive}/>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 24, padding: "12px 4px 14px" }}>
          {[
            { val: activities.length, label: "STOPS" },
            { val: visited,           label: "VISITED" },
            { val: totalHrs,          label: "HRS" },
          ].map(s => (
            <div key={s.label}>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 17, fontWeight: 600, color: "var(--hh-ink-900)" }}>{s.val}</span>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.1em", marginLeft: 5 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity stack */}
      <div style={{ padding: "16px 16px 100px" }}>
        {activities.length === 0 ? (
          <p style={{ textAlign: "center", paddingTop: 48, fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-400)", letterSpacing: "0.1em" }}>
            No activities yet.
          </p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="activities">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {activities.map((act, i) => (
                    <Draggable key={act.id} draggableId={act.id} index={i}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...provided.draggableProps.style,
                            marginBottom: snapshot.isDragging ? 0 : undefined,
                          }}
                        >
                          <ActivityCard
                            activity={act}
                            index={i}
                            onToggle={toggleActivity}
                            dragHandleProps={provided.dragHandleProps}
                            onInfoClick={act.place_id ? () => router.push(`/places/${act.place_id}`) : undefined}
                          />
                          {i < activities.length - 1 && !snapshot.isDragging && (
                            <Connector from={act} to={activities[i + 1]} fromIndex={i}/>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* FAB */}
      <div style={{ position: "fixed", bottom: 84, right: 20, zIndex: 20 }}>
        <button onClick={() => setShowAddSheet(true)} style={{ display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 22px", borderRadius: 999, background: "var(--hh-copper-600)", border: "none", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, cursor: "pointer", boxShadow: "0 6px 20px rgba(182,90,55,0.38)" }}>
          <Plus size={16} strokeWidth={2}/>
          Add activity
        </button>
      </div>

      {/* Achievement toast */}
      {achievementToast && <AchievementToast {...achievementToast}/>}

      {/* Add activity sheet */}
      {showAddSheet && activeDay && (
        <AddActivitySheet
          tripDayId={activeDay.id}
          orderIndex={activities.length}
          existingPlaceIds={days.flatMap(d =>
            d.trip_activities.map(a => a.place_id).filter((id): id is string => id !== null)
          )}
          onAdd={newActivity => {
            setDays(prev => prev.map((d, i) =>
              i === activeDayIdx
                ? { ...d, trip_activities: [...d.trip_activities, newActivity] }
                : d
            ));
          }}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  );
}
