"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Utensils, Flame, Landmark, Gem, TreePine, Moon,
  Building2, ShoppingBag, Users, History, Coffee, CalendarDays, ChevronLeft,
  Waves, Wine, Play, Footprints, MapPin, LocateFixed, Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { generateTripDays } from "@/lib/trip-generator";
import { preloadPlaces, getPlaces } from "@/lib/places-cache";
import type { Place } from "@/types/database.types";

// ── Shared chrome ────────────────────────────────────────────
function OnbChrome({ children, cta, step, total = 3, onBack }: { children: React.ReactNode; cta?: React.ReactNode; step: number; total?: number; onBack?: () => void }) {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", position: "relative", background: "var(--hh-linen-100)", color: "var(--hh-ink-700)", fontFamily: "var(--font-geist-sans)", overflowX: "hidden" }}>
      {/* paper grain */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(58,52,43,0.045) 1px, transparent 1px)", backgroundSize: "3px 3px", zIndex: 0 }}/>

      {/* top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10, padding: "56px 24px 0", background: "var(--hh-linen-100)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button
            onClick={onBack}
            style={{ width: 40, height: 40, borderRadius: 999, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", display: "grid", placeItems: "center", cursor: onBack ? "pointer" : "default", opacity: onBack ? 1 : 0.35 }}
          >
            <ChevronLeft size={18} color="var(--hh-ink-900)" strokeWidth={1.6}/>
          </button>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--hh-ink-900)" }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.25" fill="none" stroke="var(--hh-ink-900)" strokeWidth="1.25"/><circle cx="7" cy="7" r="2" fill="var(--hh-ink-900)"/></svg>
            <span>hello<span style={{ opacity: 0.55 }}>·</span>hel</span>
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>
            0{step} / 0{total}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "var(--hh-ink-900)" : "var(--hh-linen-300)", transition: "background 0.2s" }}/>
          ))}
        </div>
      </div>

      {/* page content — body scrolls naturally (no overflow on div = no iOS touch bug) */}
      <div style={{ position: "relative", zIndex: 1, paddingTop: 132, paddingBottom: cta ? 100 : 40 }}>
        {children}
      </div>

      {/* CTA pinned to bottom of viewport */}
      {cta && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "12px 24px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 16px))", background: "var(--hh-linen-100)", borderTop: "0.5px solid var(--hh-linen-200)" }}>
          {cta}
        </div>
      )}
    </div>
  );
}

function CtaPrimary({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: "100%", height: 60, borderRadius: 28, border: "none", background: disabled ? "var(--hh-linen-300)" : "var(--hh-ink-900)", color: disabled ? "var(--hh-stone-500)" : "var(--hh-linen-50)", fontFamily: "var(--font-geist-sans)", fontSize: 16, fontWeight: 500, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: disabled ? "none" : "0 8px 24px rgba(26,22,17,0.25), inset 0 1px 0 rgba(255,255,255,0.08)", cursor: disabled ? "not-allowed" : "pointer", transition: "background 0.15s" }}
    >
      {children}
    </button>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3.5 9h11M10 4.5l4.5 4.5L10 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Step 1 — Trip length (TripLengthA scrubber + big number) ──
// ── Helsinki hotels data ─────────────────────────────────────
// Approximate central-Helsinki coordinates per address. Used for
// proximity-sorting when the user taps the GPS pin in the search bar.
interface HelsinkiHotel { name: string; address: string; lat: number; lng: number; }

const HELSINKI_HOTELS: HelsinkiHotel[] = [
  { name: "Marski by Scandic",                  address: "Mannerheimintie 10, Helsinki",              lat: 60.1697, lng: 24.9357 },
  { name: "Scandic Simonkenttä",                address: "Simonkatu 9, Helsinki",                     lat: 60.1697, lng: 24.9319 },
  { name: "Scandic Grand Central Helsinki",     address: "Vilhonkatu 13, Helsinki",                   lat: 60.1726, lng: 24.9450 },
  { name: "Scandic Helsinki Hub",               address: "Annankatu 18, Helsinki",                    lat: 60.1671, lng: 24.9351 },
  { name: "Scandic Grand Marina",               address: "Katajanokanlaituri 7, Helsinki",            lat: 60.1660, lng: 24.9620 },
  { name: "Scandic Paasi",                      address: "Paasivuorenkatu 5 B, Helsinki",             lat: 60.1815, lng: 24.9550 },
  { name: "Scandic Park Helsinki",              address: "Mannerheimintie 46, Helsinki",              lat: 60.1830, lng: 24.9210 },
  { name: "Scandic Kaisaniemi",                 address: "Kaisaniemenkatu 7, Helsinki",               lat: 60.1722, lng: 24.9474 },
  { name: "Scandic Meilahti",                   address: "Tukholmankatu 2, Helsinki",                 lat: 60.1942, lng: 24.9089 },
  { name: "Scandic Hakaniemi",                  address: "Siltasaarenkatu 14, Helsinki",              lat: 60.1820, lng: 24.9510 },
  { name: "Scandic Kallio",                     address: "Läntinen Brahenkatu 2, Helsinki",           lat: 60.1830, lng: 24.9580 },
  { name: "Scandic Helsinki Station",           address: "Elielinaukio 5, Helsinki",                  lat: 60.1709, lng: 24.9405 },
  { name: "Hotel Haven",                        address: "Unioninkatu 17, 00130 Helsinki",            lat: 60.1689, lng: 24.9520 },
  { name: "Hotel Kämp",                         address: "Pohjoisesplanadi 29, 00100 Helsinki",       lat: 60.1683, lng: 24.9446 },
  { name: "NH Collection Helsinki Grand Hansa", address: "Mannerheimintie 5, 00100 Helsinki",         lat: 60.1696, lng: 24.9385 },
  { name: "Crowne Plaza Helsinki-Hesperia",     address: "Mannerheimintie 50, 00260 Helsinki",        lat: 60.1864, lng: 24.9156 },
  { name: "Hilton Helsinki Strand",             address: "John Stenbergin ranta 4, 00530 Helsinki",   lat: 60.1797, lng: 24.9554 },
  { name: "Hotel Glo Kluuvi",                   address: "Kluuvikatu 4, 00100 Helsinki",              lat: 60.1689, lng: 24.9436 },
  { name: "Hotel Lilla Roberts",                address: "Pieni Roobertinkatu 1-3, 00130 Helsinki",   lat: 60.1635, lng: 24.9430 },
  { name: "Klaus K Helsinki",                   address: "Bulevardi 2-4, Helsinki",                   lat: 60.1665, lng: 24.9395 },
  { name: "Radisson Blu Plaza Hotel, Helsinki", address: "Mikonkatu 23, Helsinki",                    lat: 60.1700, lng: 24.9445 },
  { name: "Clarion Hotel Mestari",              address: "Fredrikinkatu 51-53, Helsinki",             lat: 60.1660, lng: 24.9311 },
  { name: "Hotel Arthur",                       address: "Vuorikatu 19, 00100 Helsinki",              lat: 60.1718, lng: 24.9466 },
  { name: "Hotel F6",                           address: "Fabianinkatu 6, 00130 Helsinki",            lat: 60.1680, lng: 24.9495 },
  { name: "Hotel St. George",                   address: "Yrjönkatu 13, 00120 Helsinki",              lat: 60.1672, lng: 24.9384 },
  { name: "Hotel U14",                          address: "Unioninkatu 14, 00130 Helsinki",            lat: 60.1683, lng: 24.9530 },
  { name: "Original Sokos Hotel Presidentti",   address: "Eteläinen Rautatiekatu 4, 00100 Helsinki",  lat: 60.1690, lng: 24.9326 },
  { name: "Original Sokos Hotel Vaakuna",       address: "Asema-aukio 2, 00100 Helsinki",             lat: 60.1707, lng: 24.9404 },
  { name: "Hotel Anna",                         address: "Annankatu 1, 00120 Helsinki",               lat: 60.1655, lng: 24.9374 },
  { name: "Hotel Finn",                         address: "Kalevankatu 3 B, FI-00100 Helsinki",        lat: 60.1655, lng: 24.9352 },
  { name: "Omena Hotel Helsinki City Centre",   address: "Yrjönkatu 30, Kamppi, Helsinki",            lat: 60.1656, lng: 24.9362 },
  { name: "Omena Hotel Helsinki Lönnrotinkatu", address: "Lönnrotinkatu 13, 00120 Helsinki",          lat: 60.1656, lng: 24.9367 },
  { name: "Hotel Helka",                        address: "Pohjoinen Rautatiekatu 23, Helsinki",       lat: 60.1771, lng: 24.9263 },
  { name: "Hotel Fabian",                       address: "Fabianinkatu 7, Helsinki",                  lat: 60.1681, lng: 24.9498 },
  { name: "Home Hotel Katajanokka",             address: "Merikasarminkatu 1 A, 00160 Helsinki",      lat: 60.1620, lng: 24.9655 },
  { name: "Radisson Blu Seaside Hotel",         address: "Ruoholahdenranta 3, 00180 Helsinki",        lat: 60.1605, lng: 24.9168 },
  { name: "Lapland Hotels Bulevardi",           address: "Bulevardi 28, 00120 Helsinki",              lat: 60.1654, lng: 24.9355 },
  { name: "Hotel Indigo Helsinki - Boulevard",  address: "Bulevardi 26, 00120 Helsinki",              lat: 60.1656, lng: 24.9362 },
  { name: "Hobo Helsinki",                      address: "Kluuvikatu 4, Helsinki",                    lat: 60.1689, lng: 24.9436 },
  { name: "Waldorf Astoria Helsinki",           address: "Mariankatu 23, 00170 Helsinki",             lat: 60.1715, lng: 24.9544 },
  { name: "Original Sokos Hotel Albert",        address: "Albertinkatu 30, 00120 Helsinki",           lat: 60.1644, lng: 24.9311 },
  { name: "Solo Sokos Hotel Torni",             address: "Yrjönkatu 26, 00100 Helsinki",              lat: 60.1671, lng: 24.9384 },
  { name: "Hotel Rivoli Jardin",                address: "Kasarmikatu 40, 00130 Helsinki",            lat: 60.1646, lng: 24.9505 },
  { name: "Home Hotel Jugend",                  address: "Lönnrotinkatu 29, 00180 Helsinki",          lat: 60.1641, lng: 24.9322 },
  { name: "Radisson Blu Aleksanteri Hotel",     address: "Albertinkatu 34, 00180 Helsinki",           lat: 60.1641, lng: 24.9303 },
  { name: "Solo Sokos Hotel Pier 4",            address: "Katajanokanlaituri 4, 00160 Helsinki",      lat: 60.1660, lng: 24.9617 },
  { name: "Radisson RED Helsinki",              address: "Vuorikatu 24, 00100 Helsinki",              lat: 60.1729, lng: 24.9476 },
  { name: "Citybox Helsinki",                   address: "Kolmas Linja 8 B, 00530 Helsinki",          lat: 60.1838, lng: 24.9598 },
  { name: "Bob W Helsinki Kamppi",              address: "Lönnrotinkatu 20, 00120 Helsinki",          lat: 60.1650, lng: 24.9344 },
  { name: "Solo Sokos Hotel Helsinki",          address: "Kluuvikatu 8, 00100 Helsinki",              lat: 60.1696, lng: 24.9434 },
];

// Snap a "HH:MM" string to "HH:00" for hour-precise time inputs.
function snapToHour(t: string): string {
  if (!t) return t;
  const [h] = t.split(":");
  return `${(h ?? "0").padStart(2, "0")}:00`;
}

// ── Step 1 — Arrival & Departure dates ───────────────────────
// (Duration is derived automatically from the picked dates; no separate
// duration slider step.)
type TimeSlotId = "morning" | "afternoon" | "evening" | "night";
type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type CtxTag = { Icon: LucideIcon; label: string };

const ARRIVAL_CONTEXTS: Record<TimeSlotId, { bg: string; label: string; title: string; desc: string; tags: CtxTag[] }> = {
  morning: {
    bg: "#2D4A3E",
    label: "MORNING ARRIVAL",
    title: "Full first day ahead.",
    desc: "Markets open, cafés ready. We've planned from 9am.",
    tags: [{ Icon: Coffee, label: "Coffee" }, { Icon: Landmark, label: "Cathedral" }, { Icon: Waves, label: "Harbourfront" }],
  },
  afternoon: {
    bg: "#4A6741",
    label: "AFTERNOON ARRIVAL",
    title: "Afternoon arrival.",
    desc: "Start light — coffee, a walk, dinner to remember.",
    tags: [{ Icon: Coffee, label: "Coffee" }, { Icon: Footprints, label: "Stroll" }, { Icon: Utensils, label: "Dinner" }],
  },
  evening: {
    bg: "#C1693A",
    label: "EVENING ARRIVAL",
    title: "Evening landing.",
    desc: "Perfect for dinner, a sauna, the city at dusk.",
    tags: [{ Icon: Flame, label: "Sauna" }, { Icon: Wine, label: "Wine" }, { Icon: Building2, label: "City" }],
  },
  night: {
    bg: "#1A1714",
    label: "LATE ARRIVAL",
    title: "Late arrival.",
    desc: "Rest first. We'll have tomorrow ready for you.",
    tags: [{ Icon: Moon, label: "Rest" }, { Icon: Coffee, label: "Tomorrow" }, { Icon: Play, label: "Explore" }],
  },
};

function getTimeSlotId(time: string): TimeSlotId {
  const h = parseInt(time.split(":")[0], 10);
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function formatDateCard(isoDate: string): { day: string; num: string; month: string } {
  const d = parseISO(isoDate);
  return {
    day:   format(d, "EEE").toUpperCase(),
    num:   format(d, "d"),
    month: format(d, "MMMM"),
  };
}

function todayIso() { return format(new Date(), "yyyy-MM-dd"); }
function defaultDepartureIso(arrivalIso: string, days: number) {
  const d = parseISO(arrivalIso);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

interface StepArrivalProps {
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  onChangeArrivalDate: (v: string) => void;
  onChangeArrivalTime: (v: string) => void;
  onChangeDepartureDate: (v: string) => void;
  onChangeDepartureTime: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function StepArrivalDeparture({
  arrivalDate, arrivalTime, departureDate, departureTime,
  onChangeArrivalDate, onChangeArrivalTime, onChangeDepartureDate, onChangeDepartureTime,
  onNext, onBack,
}: StepArrivalProps) {
  const [activeCard, setActiveCard] = useState<"arrival" | "departure">("arrival");

  const nights = arrivalDate && departureDate
    ? Math.max(0, differenceInCalendarDays(parseISO(departureDate), parseISO(arrivalDate)))
    : null;

  const isDayTrip = nights === 0;
  const slotId = getTimeSlotId(arrivalTime);
  const ctx = ARRIVAL_CONTEXTS[slotId];

  function handleArrivalDateChange(val: string) {
    onChangeArrivalDate(val);
    if (departureDate && val >= departureDate) {
      const d = parseISO(val);
      d.setDate(d.getDate() + 1);
      onChangeDepartureDate(format(d, "yyyy-MM-dd"));
    }
  }

  // Shared style for invisible-but-interactive native inputs
  const inputOverlay: React.CSSProperties = {
    position: "absolute", inset: 0,
    opacity: 0, cursor: "pointer",
    width: "100%", height: "100%",
    WebkitAppearance: "none",
  };

  const canContinue = !!arrivalDate && !!arrivalTime && !!departureDate && !!departureTime;

  return (
    <OnbChrome step={1} total={5} onBack={onBack} cta={
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="var(--hh-ink-900)" strokeWidth={1.6}/>
        </button>
        <div style={{ flex: 1 }}>
          <CtaPrimary onClick={onNext} disabled={!canContinue}>Continue <Arrow/></CtaPrimary>
        </div>
      </div>
    }>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 01 · The shape of it</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          When does <span style={{ fontStyle: "italic" }}>Helsinki</span><br/>begin?
        </div>
      </div>

      {/* Date cards */}
      <div style={{ padding: "28px 24px 0", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>

        {/* ── Arrival card ── */}
        <div
          style={{ position: "relative", borderRadius: 20, border: activeCard === "arrival" ? "2px solid #C1693A" : "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", overflow: "hidden" }}
        >
          {/* Date tap zone */}
          <div
            style={{ position: "relative", padding: "16px 16px 12px", cursor: "pointer" }}
            onClick={() => setActiveCard("arrival")}
          >
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, letterSpacing: "0.16em", color: activeCard === "arrival" ? "#C1693A" : "var(--hh-stone-400)", textTransform: "uppercase", marginBottom: 8, fontWeight: 600, pointerEvents: "none" }}>Arrival</div>
            {arrivalDate ? (() => {
              const { day, num, month } = formatDateCard(arrivalDate);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2, pointerEvents: "none" }}>
                    <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.06em" }}>{day}</span>
                    <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 0.9, color: "var(--hh-ink-900)", letterSpacing: "-0.03em" }}>{num}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, fontStyle: "italic", color: "var(--hh-ink-700)", pointerEvents: "none" }}>{month}</div>
                </>
              );
            })() : (
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, fontStyle: "italic", color: "var(--hh-stone-400)", marginTop: 4, pointerEvents: "none" }}>Pick date</div>
            )}
            {/* Invisible date input covers the entire date zone */}
            <input
              type="date"
              value={arrivalDate}
              min={todayIso()}
              onChange={e => { setActiveCard("arrival"); handleArrivalDateChange(e.target.value); }}
              style={inputOverlay}
            />
          </div>

          {/* Time tap zone */}
          <div
            style={{ position: "relative", borderTop: "0.5px dashed var(--hh-linen-300)", padding: "10px 16px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            onClick={() => setActiveCard("arrival")}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ pointerEvents: "none" }}><circle cx="8" cy="8" r="6.5" stroke="var(--hh-stone-400)" strokeWidth="1.2"/><path d="M8 5v3.5l2 1.5" stroke="var(--hh-stone-400)" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, color: arrivalTime ? "var(--hh-ink-900)" : "var(--hh-stone-400)", letterSpacing: "0.08em", pointerEvents: "none" }}>{arrivalTime || "hh:00"}</span>
            {/* Invisible time input — hour precision (step=3600 s) */}
            <input
              type="time"
              step={3600}
              value={arrivalTime}
              onChange={e => { setActiveCard("arrival"); onChangeArrivalTime(snapToHour(e.target.value)); }}
              style={inputOverlay}
            />
          </div>
        </div>

        {/* Nights display */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: nights !== null ? 32 : 22, color: "var(--hh-ink-900)", lineHeight: 1 }}>{nights !== null ? nights : "·"}</span>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{nights !== null ? "nights" : ""}</span>
          <span style={{ fontSize: 14, color: "var(--hh-stone-400)", marginTop: 2 }}>→</span>
        </div>

        {/* ── Departure card ── */}
        <div
          style={{ position: "relative", borderRadius: 20, border: activeCard === "departure" ? "2px solid #C1693A" : "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", overflow: "hidden" }}
        >
          {/* Date tap zone */}
          <div
            style={{ position: "relative", padding: "16px 16px 12px", cursor: "pointer" }}
            onClick={() => setActiveCard("departure")}
          >
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, letterSpacing: "0.16em", color: activeCard === "departure" ? "#C1693A" : "var(--hh-stone-400)", textTransform: "uppercase", marginBottom: 8, fontWeight: 600, pointerEvents: "none" }}>Departure</div>
            {departureDate ? (() => {
              const { day, num, month } = formatDateCard(departureDate);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2, pointerEvents: "none" }}>
                    <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.06em" }}>{day}</span>
                    <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 0.9, color: "var(--hh-ink-900)", letterSpacing: "-0.03em" }}>{num}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, fontStyle: "italic", color: "var(--hh-ink-700)", pointerEvents: "none" }}>{month}</div>
                </>
              );
            })() : (
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, fontStyle: "italic", color: "var(--hh-stone-400)", marginTop: 4, pointerEvents: "none" }}>Pick date</div>
            )}
            {/* Invisible date input covers the entire date zone */}
            <input
              type="date"
              value={departureDate}
              min={arrivalDate || todayIso()}
              onChange={e => { setActiveCard("departure"); onChangeDepartureDate(e.target.value); }}
              style={inputOverlay}
            />
          </div>

          {/* Time tap zone */}
          <div
            style={{ position: "relative", borderTop: "0.5px dashed var(--hh-linen-300)", padding: "10px 16px 14px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            onClick={() => setActiveCard("departure")}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ pointerEvents: "none" }}><circle cx="8" cy="8" r="6.5" stroke="var(--hh-stone-400)" strokeWidth="1.2"/><path d="M8 5v3.5l2 1.5" stroke="var(--hh-stone-400)" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, color: departureTime ? "var(--hh-ink-900)" : "var(--hh-stone-400)", letterSpacing: "0.08em", pointerEvents: "none" }}>{departureTime || "hh:00"}</span>
            {/* Invisible time input — hour precision (step=3600 s) */}
            <input
              type="time"
              step={3600}
              value={departureTime}
              onChange={e => { setActiveCard("departure"); onChangeDepartureTime(snapToHour(e.target.value)); }}
              style={inputOverlay}
            />
          </div>
        </div>
      </div>

      {/* Day-trip notice */}
      {isDayTrip && (
        <div style={{ margin: "12px 24px 0", padding: "10px 16px", borderRadius: 12, background: "rgba(193,105,58,0.08)", border: "0.5px solid rgba(193,105,58,0.3)", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "#C1693A" }}>
          A day trip? We'll make it count.
        </div>
      )}

      {/* Arrival context card — driven by the chosen arrival hour */}
      {arrivalTime && (
        <div style={{ margin: "20px 24px 0", borderRadius: 20, background: ctx.bg, padding: "20px 20px 22px", transition: "background 0.3s ease" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(250,247,241,0.6)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: 999, background: "rgba(250,247,241,0.5)" }}/>
            {ctx.label} · {arrivalTime}
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#FAF7F1", marginBottom: 8 }}>{ctx.title}</div>
          <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, lineHeight: 1.5, color: "rgba(250,247,241,0.8)", marginBottom: 16 }}>{ctx.desc}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ctx.tags.map(({ Icon, label }) => (
              <div key={label} style={{ background: "rgba(250,247,241,0.12)", border: "0.5px solid rgba(250,247,241,0.2)", borderRadius: 999, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={11} color="rgba(250,247,241,0.85)" strokeWidth={1.8}/>
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "rgba(250,247,241,0.9)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </OnbChrome>
  );
}

// ── Step 2 — Budget (BudgetB euro signs + slider + context card)
const BUDGET_TIERS = [
  { n: 1, mark: "€",   title: "Coffee-shop curious", spend: "€30–60",  pitch: "Public saunas, market hall lunches, the kind of day you wear out your shoes.", moments: [{ name: "Cinnamon bun · Sävy", price: "€4.50" }, { name: "Allas pools · daysplash", price: "€16" }, { name: "Suomenlinna ferry", price: "€3.10" }], tint: "var(--hh-moss-700)" },
  { n: 2, mark: "€€",  title: "A proper day out",   spend: "€70–150", pitch: "Long lunches, design shops, a private sauna shift, maybe a ferry to dinner.", moments: [{ name: "Lunch at Story", price: "€26" }, { name: "Marimekko · Outlet", price: "€85" }, { name: "Löyly · evening sauna", price: "€22" }], tint: "var(--hh-copper-600)" },
  { n: 3, mark: "€€€", title: "Treat yourself",     spend: "€180+",   pitch: "Tasting menus, private island saunas, taxi-boats, the long table by the window.", moments: [{ name: "Tasting at Olo", price: "€189" }, { name: "Lonna · private sauna", price: "€420" }, { name: "Room · Hotel Maria", price: "€340" }], tint: "var(--hh-baltic-700)" },
] as const;

function BudgetSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Draggable slider — clicking AND dragging both update the value.
  // The hit area is taller than the visible track for easier touch.
  const trackRef    = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pct         = ((value - 1) / 2) * 100;

  const valueFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * 2) + 1; // → 1, 2, or 3
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    const v = valueFromClientX(e.clientX);
    if (v !== value) onChange(v);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const v = valueFromClientX(e.clientX);
    if (v !== value) onChange(v);
  };
  const handlePointerUp = () => { draggingRef.current = false; };

  return (
    <div style={{ padding: "8px 0 4px" }}>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ position: "relative", height: 36, margin: "0 8px", cursor: "pointer", touchAction: "none", display: "flex", alignItems: "center" }}
      >
        {/* Visible track */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: "var(--hh-linen-300)" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "var(--hh-ink-900)", borderRadius: 2, transition: "width 0.18s ease" }}/>
          {[1, 2, 3].map((s, i) => {
            const pos    = (i / 2) * 100;
            const active = s === value;
            return (
              <div
                key={s}
                style={{
                  position: "absolute", top: "50%", left: `${pos}%`,
                  transform: "translate(-50%, -50%)",
                  width: active ? 22 : 10, height: active ? 22 : 10, borderRadius: 999,
                  background: active ? "var(--hh-copper-600)" : i < value - 1 ? "var(--hh-ink-900)" : "var(--hh-linen-50)",
                  border:     active ? "none" : i < value - 1 ? "none" : "1.5px solid var(--hh-linen-300)",
                  zIndex: active ? 2 : 1,
                  pointerEvents: "none", // track owns the gesture
                  transition: "width 0.18s, height 0.18s, background 0.18s",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepBudget({ value, onChange, onNext, onBack }: { value: number; onChange: (n: number) => void; onNext: () => void; onBack: () => void }) {
  const tier = BUDGET_TIERS[value - 1];
  return (
    <OnbChrome step={4} total={5} onBack={onBack} cta={
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="var(--hh-ink-900)" strokeWidth={1.6}/>
        </button>
        <div style={{ flex: 1 }}><CtaPrimary onClick={onNext}>Continue <Arrow/></CtaPrimary></div>
      </div>
    }>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 04 · Money talk</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          Pick your <span style={{ fontStyle: "italic" }}>tempo.</span>
        </div>
      </div>

      {/* Euro signs row */}
      <div style={{ padding: "36px 24px 0", display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
        {BUDGET_TIERS.map(t => {
          const active = t.n === value;
          return (
            <button key={t.n} onClick={() => onChange(t.n)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 0 }}>
              <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: active ? 76 : 48, lineHeight: 0.85, letterSpacing: "-0.04em", color: active ? "var(--hh-copper-600)" : "var(--hh-linen-300)", transition: "all 0.2s" }}>
                {t.mark}
              </span>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, letterSpacing: "0.06em", color: active ? "var(--hh-ink-900)" : "var(--hh-stone-400)", fontWeight: active ? 600 : 400, transition: "color 0.2s" }}>
                {t.spend}/D
              </span>
            </button>
          );
        })}
      </div>

      {/* Slider */}
      <div style={{ padding: "24px 24px 0" }}>
        <BudgetSlider value={value} onChange={onChange}/>
      </div>

      {/* Context card */}
      <div style={{ padding: "24px 24px 0" }}>
        <div style={{ borderRadius: 20, background: tier.tint, padding: "20px 20px 22px", transition: "background 0.2s" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(250,247,241,0.65)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            A day in the life · {tier.mark}
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--hh-linen-50)", marginBottom: 12 }}>
            {tier.title}.
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(250,247,241,0.85)", marginBottom: 16 }}>
            {tier.pitch}
          </div>
          <div style={{ borderTop: "0.5px solid rgba(250,247,241,0.25)", paddingTop: 12 }}>
            {tier.moments.map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBlock: 5 }}>
                <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-linen-50)" }}>{m.name}</span>
                <div style={{ flex: 1, borderBottom: "1px dotted rgba(250,247,241,0.35)", transform: "translateY(-3px)" }}/>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-linen-50)", letterSpacing: "0.02em" }}>{m.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </OnbChrome>
  );
}

// ── Step 5 — Accommodation ───────────────────────────────────
interface AccommodationResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function formatDistance(m: number): string {
  if (m < 500) return `${Math.round(m)} m`;
  return `${Math.round(m / 80)} min walk`;
}

interface StepAccommodationProps {
  accommodationName: string;
  accommodationAddress: string;
  accommodationLat: number | null;
  accommodationLng: number | null;
  onSelect: (r: AccommodationResult) => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

function StepAccommodation({
  accommodationName, accommodationAddress, accommodationLat, accommodationLng,
  onSelect, onSkip, onNext, onBack,
}: StepAccommodationProps) {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<AccommodationResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [nearbyPlaces, setNearby]   = useState<{ name: string; category: string; distanceM: number }[]>([]);
  // GPS-derived sort: when the user taps the locate pin we get their device
  // coordinates and rank HELSINKI_HOTELS by distance from there.
  const [gpsCoords, setGpsCoords]   = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError]     = useState<string | null>(null);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected                    = !!accommodationName;

  // Sort hotels by distance from GPS (when set) or alphabetically (default)
  const hotelList = useMemo(() => {
    if (!gpsCoords) {
      return HELSINKI_HOTELS.slice(0, 8); // default: first 8 alphabetically
    }
    return HELSINKI_HOTELS
      .map(h => ({ ...h, distanceM: haversineMeters(gpsCoords.lat, gpsCoords.lng, h.lat, h.lng) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 8);
  }, [gpsCoords]);

  const handleGpsClick = () => {
    if (!navigator.geolocation) {
      setGpsError("Sijaintipalvelut eivät käytettävissä");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setGpsError("Sijaintia ei voitu hakea");
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  };

  // Fetch nearby places when accommodation selected (uses cache)
  useEffect(() => {
    if (!accommodationLat || !accommodationLng) return;
    getPlaces().then(data => {
      const sorted = data
        .map(p => ({ name: p.name, category: p.category, distanceM: haversineMeters(accommodationLat, accommodationLng, p.lat, p.lng) }))
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 3);
      setNearby(sorted);
    });
  }, [accommodationLat, accommodationLng]);

  // Nominatim geocoding with debounce
  useEffect(() => {
    if (query.length < 3) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Helsinki")}&format=json&viewbox=24.7,60.4,25.3,59.9&bounded=1&limit=4&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = await res.json();
        setResults(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any[]).map((f: any) => ({
            name: f.name || f.display_name.split(",")[0],
            address: f.display_name,
            lat: parseFloat(f.lat),
            lng: parseFloat(f.lon),
          }))
        );
      } catch { setResults([]); }
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);


  return (
    <OnbChrome step={2} total={5} onBack={onBack} cta={
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <button
          onClick={selected ? onNext : onSkip}
          style={{
            width: "100%", height: 60, borderRadius: 28, border: "none",
            background: selected ? "#C1693A" : "var(--hh-ink-900)",
            color: "#FAF7F1",
            fontFamily: "var(--font-geist-sans)", fontSize: 16, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: selected ? "0 8px 24px rgba(193,105,58,0.35)" : "0 8px 24px rgba(26,22,17,0.25)",
            cursor: "pointer", transition: "background 0.3s, box-shadow 0.3s",
          }}
        >
          Continue <Arrow/>
        </button>
        {!selected && (
          <button
            onClick={onSkip}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-stone-400)", textDecoration: "underline", textDecorationColor: "var(--hh-linen-300)", marginTop: 12, padding: 0 }}
          >
            Skip — we&apos;ll use city centre as your base
          </button>
        )}
      </div>
    }>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 02 · Your base</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          Where&apos;s <span style={{ fontStyle: "italic" }}>home</span><br/>for these days?
        </div>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: "var(--hh-ink-700)" }}>We&apos;ll build your days around it — shorter walks, smarter routes.</p>
      </div>

      {selected ? (
        /* ── Confirmation card ── */
        <div style={{ margin: "28px 24px 0" }}>
          <div style={{ borderRadius: 20, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", padding: "20px 20px 22px" }}>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Your neighbourhood</div>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--hh-ink-900)", marginBottom: 4 }}>{accommodationName}.</div>
            <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, color: "var(--hh-stone-400)", marginBottom: 20, lineHeight: 1.4 }}>{accommodationAddress}</div>

            {nearbyPlaces.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Nearby on your list</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {nearbyPlaces.map(p => (
                    <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: "var(--hh-copper-600)", flex: "0 0 auto" }}/>
                      <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-ink-900)", flex: 1 }}>{p.name}</span>
                      <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.04em" }}>{formatDistance(p.distanceM)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => { onSelect({ name: "", address: "", lat: 0, lng: 0 }); setQuery(""); }}
              style={{ marginTop: 20, background: "none", border: "0.5px solid var(--hh-linen-300)", borderRadius: 999, padding: "8px 16px 8px 14px", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-stone-500)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Undo2 size={14} strokeWidth={1.6}/>
              Change
            </button>
          </div>
        </div>
      ) : (
        /* ── Search UI ── */
        <div style={{ padding: "28px 24px 0" }}>
          {/* Search input with GPS pin */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="var(--hh-stone-400)" strokeWidth="1.3"/><path d="M11 11l3 3" stroke="var(--hh-stone-400)" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Hotel or address..."
              style={{ width: "100%", height: 52, borderRadius: 14, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", paddingLeft: 42, paddingRight: 52, fontFamily: "var(--font-geist-sans)", fontSize: 15, color: "var(--hh-ink-900)", outline: "none", boxSizing: "border-box" }}
            />
            {/* Geocoding spinner (Nominatim) — shown while query is typed */}
            {loading && (
              <div style={{ position: "absolute", right: 52, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, borderRadius: 999, border: "1.5px solid var(--hh-stone-400)", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }}/>
            )}
            {/* GPS pin — taps grab device location and sort hotels by proximity */}
            <button
              onClick={handleGpsClick}
              disabled={gpsLoading}
              aria-label="Use my location"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 36, height: 36, borderRadius: 999, border: "none",
                background: gpsCoords ? "var(--hh-ink-900)" : "var(--hh-linen-200)",
                display: "grid", placeItems: "center",
                cursor: gpsLoading ? "default" : "pointer",
                opacity: gpsLoading ? 0.6 : 1,
                transition: "background 0.2s, opacity 0.2s",
              }}
            >
              <LocateFixed size={15} strokeWidth={1.8} color={gpsCoords ? "#FAF7F1" : "var(--hh-stone-500)"}/>
            </button>
          </div>

          {/* GPS error/status hint */}
          {gpsError && (
            <div style={{ marginTop: -8, marginBottom: 12, fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "#C0392B", letterSpacing: "0.04em" }}>
              {gpsError}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Suggestions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { onSelect(r); setQuery(""); setResults([]); }}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <MapPin size={14} color="var(--hh-stone-500)" strokeWidth={1.5}/>
                    </div>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500, color: "var(--hh-ink-900)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "var(--hh-stone-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — Helsinki hotels (proximity-sorted after GPS tap) */}
          {!query && (
            <div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{gpsCoords ? "Nearest hotels" : "Helsinki hotels"}</span>
                {gpsCoords && (
                  <button
                    onClick={() => { setGpsCoords(null); setGpsError(null); }}
                    style={{ background: "none", border: "none", fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}
                  >
                    Reset ↻
                  </button>
                )}
              </div>
              {hotelList.map((h) => {
                const dist = "distanceM" in h ? (h as HelsinkiHotel & { distanceM: number }).distanceM : null;
                return (
                  <button
                    key={h.name}
                    onClick={() => onSelect({ name: h.name, address: h.address, lat: h.lat, lng: h.lng })}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", cursor: "pointer", textAlign: "left", marginBottom: 8, width: "100%" }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                      <MapPin size={14} color="var(--hh-stone-500)" strokeWidth={1.5}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500, color: "var(--hh-ink-900)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</div>
                      <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "var(--hh-stone-400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.address}</div>
                    </div>
                    {dist !== null && (
                      <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.04em", flex: "0 0 auto" }}>
                        {formatDistance(dist)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

    </OnbChrome>
  );
}

// ── Step 3 — Discover (curated card stack) ───────────────────
const PLACE_IMAGES: Record<string, string> = {
  "Löyly":                   "/assets/Loyly-sauna.jpg",
  "Allas Sea Pool":           "/assets/allas-sea-pool.jpg",
  "Kotiharju Sauna":          "/assets/dock-autumn-sailboat.jpg",
  "Suomenlinna":              "/assets/suomenlinna-ferry.jpg",
  "Seurasaari":               "/assets/archipelago-red-cabin.jpg",
  "Kaivopuisto Park":         "/assets/sea-swimming.jpg",
  "Hakaniemi Market":         "/assets/flea-market.jpg",
  "Old Market Hall":          "/assets/market-square-owl.jpg",
  "Helsinki Cathedral":       "/assets/helsinki-cathedral-classical.jpg",
  "Temppeliaukio Church":     "/assets/helsinki-cathedral-alley.jpg",
  "Amos Rex":                 "/assets/amos-rex.jpg",
  "Kiasma":                   "/assets/kiasma.webp",
  "Finnish National Museum":  "/assets/kaupunginmuseo.jpg",
  "HAM Helsinki":             "/assets/kaupunginmuseo.jpg",
  "Oodi Central Library":     "/assets/helsinki-tram.jpg",
  "Design Museum":            "/assets/flea-market-cafe.jpeg",
  "Marimekko Flagship":       "/assets/flea-market.jpg",
  "Artek":                    "/assets/flea-market-cafe.jpeg",
  "Hietalahti Flea Market":   "/assets/flea-market.jpg",
  "Sävy":                     "/assets/sävy-helsinki.jpg",
  "Good Life Coffee":         "/assets/flea-market-cafe.jpeg",
  "Kaffa Roastery":           "/assets/sävy-helsinki.jpg",
  "Ravintola Story":          "/assets/ravintolaterassi.jpg",
  "Ravintola Nokka":          "/assets/ravintola-helsinki.jpg",
  "Ravintola Olo":            "/assets/ravintolaterassi.jpg",
};

const DISCOVER_HEADLINES = [
  "Picks for your trip.",
  "Helsinki calling.",
  "Three for tonight.",
  "The local edit.",
  "Worth your time.",
];

const PRICE_MARK: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€" };

const CATEGORY_LABEL_UPPER: Record<string, string> = {
  food: "RESTAURANT", cafe: "CAFÉ", sauna: "WOOD-SMOKE SAUNA",
  nature: "ISLAND", museums: "MUSEUM", history: "HISTORIC SITE",
  arch: "ARCHITECTURE", design: "DESIGN", shop: "SHOPPING",
  night: "NIGHTLIFE", events: "EVENT", family: "FAMILY",
};

function StepDiscover({
  budgetLevel, interests, onNext, onBack, isSubmitting, errorMessage,
}: {
  budgetLevel: number;
  interests: string[];
  onNext: (pickedIds: string[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
}) {
  const [deck, setDeck]         = useState<Place[]>([]);
  const [idx, setIdx]           = useState(0);
  const [picked, setPicked]     = useState<string[]>([]);
  const [exiting, setExiting]   = useState(false);
  const [round, setRound]       = useState(1);
  const headlineRef             = useState(() => DISCOVER_HEADLINES[Math.floor(Math.random() * DISCOVER_HEADLINES.length)])[0];

  // Swipe drag state
  const [dragX, setDragX]         = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDown             = useRef(false);
  const dragStartX                = useRef(0);

  // Preload images — store refs so GC doesn't collect them
  const preloadRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    const INTEREST_CATEGORIES: Record<string, string[]> = {
      food: ["food", "cafe"], sauna: ["sauna"], museums: ["museums"],
      design: ["design", "shop"], nature: ["nature"], night: ["night"],
      arch: ["arch"], shop: ["shop"], family: ["nature", "museums"],
      history: ["history"], cafe: ["cafe"], events: ["museums"],
    };
    const wantedCategories = new Set(interests.flatMap(i => INTEREST_CATEGORIES[i] ?? []));

    // Uses shared places cache — typically already loaded by the time
    // the user reaches the Discover step
    getPlaces().then(data => {
      const filtered  = data.filter(p => (p.price_level ?? 1) <= budgetLevel);
      const matched   = filtered.filter(p => wantedCategories.has(p.category)).sort(() => Math.random() - 0.5);
      const unmatched = filtered.filter(p => !wantedCategories.has(p.category)).sort(() => Math.random() - 0.5);
      setDeck([...matched, ...unmatched]);
    });
  }, [budgetLevel, interests]);

  // Preload the next 3 images whenever idx changes
  useEffect(() => {
    if (!deck.length) return;
    const imgs: HTMLImageElement[] = [];
    for (let i = idx; i < Math.min(idx + 3, deck.length); i++) {
      const src = deck[i].image_url ?? PLACE_IMAGES[deck[i].name] ?? "/assets/helsinki-cathedral-alley.jpg";
      const img = new window.Image();
      img.src = src;
      imgs.push(img);
    }
    preloadRef.current = imgs; // keep reference so GC doesn't collect
  }, [deck, idx]);

  const advance = useCallback((addCurrent: boolean) => {
    const place = deck[idx];
    if (addCurrent && place) setPicked(p => [...p, place.id]);

    setDragX(0);
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      if (idx >= deck.length - 1) {
        setRound(r => r + 1);
        setIdx(0);
      } else {
        setIdx(i => i + 1);
      }
    }, 220);
  }, [deck, idx]);

  // ── Pointer / swipe handlers ──────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (exiting) return;
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    isPointerDown.current = true;
    dragStartX.current = e.clientX;
    setDragX(0);
    setIsDragging(true);
  }, [exiting]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;
    setDragX(e.clientX - dragStartX.current);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDown.current) return;
    isPointerDown.current = false;
    setIsDragging(false);
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 80) {
      advance(dx > 0);
    } else {
      setDragX(0);
    }
  }, [advance]);

  const current  = deck[idx];
  const nextCard = deck[idx + 1] ?? deck[0];

  if (!current) {
    // Skeleton card — matches the real card layout so the transition is
    // seamless once the places list arrives from the cache.
    return (
      <OnbChrome step={5} total={5} onBack={onBack} cta={null}>
        <div style={{ padding: "0 24px" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
            Chapter 05 · Discover
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
            {headlineRef}
          </div>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: "var(--hh-ink-700)" }}>
            Swipe right to add, left to skip.
          </p>
        </div>
        <div style={{ position: "relative", margin: "32px 24px 0", height: 420 }}>
          {/* Back-card skeleton */}
          <div className="hh-skeleton" style={{ position: "absolute", inset: 0, borderRadius: 22, transform: "scale(0.94) translateY(12px)", opacity: 0.7 }}/>
          {/* Front-card skeleton */}
          <div className="hh-skeleton" style={{ position: "absolute", inset: 0, borderRadius: 22 }}/>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 28 }}>
          <div className="hh-skeleton" style={{ width: 56, height: 56, borderRadius: 999 }}/>
          <div className="hh-skeleton" style={{ width: 56, height: 56, borderRadius: 999 }}/>
        </div>
      </OnbChrome>
    );
  }

  const imgSrc  = current.image_url  ?? PLACE_IMAGES[current.name]          ?? "/assets/helsinki-cathedral-alley.jpg";
  const nextImg = nextCard?.image_url ?? PLACE_IMAGES[nextCard?.name ?? ""] ?? "/assets/helsinki-cathedral-alley.jpg";
  const catLabel = CATEGORY_LABEL_UPPER[current.category] ?? current.category.toUpperCase();
  const tags     = (current.tags as string[]).slice(0, 3);

  // Derived transform values
  const frontTransform = exiting
    ? "scale(0.9) translateY(-30px)"
    : (isDragging || dragX !== 0)
    ? `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`
    : "scale(1) translateY(0)";
  const frontTransition = isDragging
    ? "none"
    : "transform 0.32s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease";

  // Stamp opacity (ADD direction only)
  const likeOpacity = Math.min(1, Math.max(0, (dragX - 25) / 55));

  // Back card scale interpolation based on drag progress
  const dragProgress = Math.min(1, Math.abs(dragX) / 120);
  const backScale    = 0.94 + dragProgress * 0.06;
  const backTranslY  = 12 - dragProgress * 12;

  return (
    <div style={{ width: "100%", minHeight: "100dvh", background: "var(--hh-linen-100)", display: "flex", flexDirection: "column", padding: "56px 20px 32px", boxSizing: "border-box" }}>
      {/* paper grain */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(58,52,43,0.045) 1px, transparent 1px)", backgroundSize: "3px 3px", zIndex: 0 }}/>

      {/* header row */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          hello·hel · curated · round {String(round).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>05 / 05</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--hh-ink-900)", borderRadius: 999, padding: "5px 12px" }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z" fill="#FAF7F1"/></svg>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-linen-50)", letterSpacing: "0.08em", fontWeight: 600 }}>{String(picked.length).padStart(2, "0")} on list</span>
          </div>
        </div>
      </div>
      {/* progress bar — final step, all 5 segments filled */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 4, marginBottom: 12 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--hh-ink-900)" }}/>
        ))}
      </div>

      {/* headline */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 0.95, letterSpacing: "-0.022em", color: "var(--hh-ink-900)", marginBottom: 10 }}>
          {headlineRef}
        </div>
        <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--hh-ink-700)", maxWidth: 300 }}>
          Picks based on your trip. Add what calls to you —{" "}
          <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontStyle: "italic" }}>we&apos;ll build around them.</span>
        </div>
      </div>

      {/* card stack */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", touchAction: "none" }}>
        {/* back card (next) — scales up as front card is dragged away */}
        {nextCard && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden",
            transform: `scale(${backScale}) translateY(${backTranslY}px)`,
            transition: isDragging ? "none" : "transform 0.32s ease",
            zIndex: 0,
          }}>
            <img src={nextImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,241,0.15)" }}/>
          </div>
        )}

        {/* front card wrapper — pointer events live here */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            position: "relative", zIndex: 1,
            height: "min(480px, 62dvh)",
            transform: frontTransform,
            opacity: exiting ? 0 : 1,
            transition: frontTransition,
            touchAction: "none",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {/* ADD stamp — appears when dragging right */}
          <div style={{
            position: "absolute", top: 22, left: 18, zIndex: 10,
            opacity: likeOpacity, pointerEvents: "none",
            transform: "rotate(-14deg)",
            border: "2.5px solid var(--hh-copper-600)",
            borderRadius: 8, padding: "4px 14px",
          }}>
            <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 18, fontWeight: 700, color: "var(--hh-copper-600)", letterSpacing: "0.1em" }}>ADD ♥</span>
          </div>


          {/* card content — position:relative so absolute overlays are clipped by overflow:hidden */}
          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden", width: "100%", height: "100%", boxShadow: "0 16px 48px rgba(26,22,17,0.22)" }}>
            {/* image */}
            <img src={imgSrc} alt={current.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}/>

            {/* top row overlay */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ background: "rgba(26,22,17,0.72)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 12px", display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "#FAF7F1", letterSpacing: "0.12em", lineHeight: 1 }}>{catLabel}</span>
              </div>
              <div style={{ background: "rgba(250,247,241,0.18)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 12px" }}>
                <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 15, color: "#FAF7F1", letterSpacing: "0.02em" }}>{PRICE_MARK[current.price_level ?? 1]}</span>
              </div>
            </div>

            {/* bottom overlay */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(26,22,17,0.88) 0%, rgba(26,22,17,0.6) 55%, transparent 100%)", padding: "48px 18px 20px" }}>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "rgba(250,247,241,0.55)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                Why this · for you
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 30, lineHeight: 1.0, letterSpacing: "-0.02em", color: "#FAF7F1", marginBottom: 8 }}>
                {current.name}
              </div>
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, lineHeight: 1.45, color: "rgba(250,247,241,0.75)", marginBottom: 12 }}>
                {current.description}
              </div>
              {tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {tags.map(tag => (
                    <span key={tag} style={{ background: "rgba(250,247,241,0.14)", border: "0.5px solid rgba(250,247,241,0.25)", borderRadius: 999, padding: "3px 10px", fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "rgba(250,247,241,0.8)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* action buttons */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 20 }}>
        <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 999, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="var(--hh-stone-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <button onClick={() => advance(false)} style={{ width: 52, height: 52, borderRadius: 999, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="var(--hh-stone-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>

        <button onClick={() => advance(true)} style={{ height: 52, padding: "0 24px", borderRadius: 999, background: "var(--hh-copper-600)", border: "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 6px 20px rgba(182,90,55,0.38)", whiteSpace: "nowrap", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#FAF7F1" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, color: "#FAF7F1" }}>Add to list</span>
        </button>

      </div>

      {errorMessage && (
        <div style={{ position: "relative", zIndex: 1, marginTop: 10, padding: "10px 16px", borderRadius: 12, background: "rgba(182,90,55,0.12)", border: "0.5px solid var(--hh-copper-600)", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-copper-600)", textAlign: "center" }}>
          {errorMessage}
        </div>
      )}

      {/* skip all */}
      <button
        onClick={() => { if (!isSubmitting) onNext(picked); }}
        disabled={isSubmitting}
        style={{ position: "relative", zIndex: 1, marginTop: 14, background: "none", border: "none", cursor: isSubmitting ? "default" : "pointer", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-stone-400)", textDecoration: "underline", textDecorationColor: "var(--hh-linen-300)", opacity: isSubmitting ? 0.5 : 1 }}
      >
        {isSubmitting ? "Building your trip…" : `Continue with ${picked.length} pick${picked.length !== 1 ? "s" : ""} →`}
      </button>
    </div>
  );
}

// ── Step 4 — Interests (InterestsA icon grid) ────────────────
const INTEREST_ITEMS = [
  { k: "food",     label: "Food & dining",     hint: "Markets, late suppers, smoked things" },
  { k: "sauna",    label: "Saunas",            hint: "Wood smoke, cold sea, repeat" },
  { k: "museums",  label: "Museums & art",     hint: "Amos Rex, Kiasma, the small rooms" },
  { k: "design",   label: "Design",            hint: "Marimekko, Artek, Design District" },
  { k: "nature",   label: "Archipelago & sea", hint: "300+ islands, ferries, granite shore" },
  { k: "night",    label: "Nightlife",         hint: "Wine bars, listening rooms, Kallio" },
  { k: "arch",     label: "Architecture",      hint: "Aalto, Saarinen, Oodi, Amos Rex" },
  { k: "shop",     label: "Shopping",          hint: "Old Hall, flea markets, slow brands" },
  { k: "family",   label: "Family",            hint: "Linnanmäki, Korkeasaari, parks" },
  { k: "history",  label: "History",           hint: "Suomenlinna, war stories, old town" },
  { k: "cafe",     label: "Café culture",      hint: "Cinnamon buns, slow oat lattes" },
  { k: "events",   label: "Events",            hint: "What's on this week, only good" },
] as const;

const CATEGORY_ICON: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  food:    Utensils,
  sauna:   Flame,
  museums: Landmark,
  design:  Gem,
  nature:  TreePine,
  night:   Moon,
  arch:    Building2,
  shop:    ShoppingBag,
  family:  Users,
  history: History,
  cafe:    Coffee,
  events:  CalendarDays,
};

function StepInterests({ value, onChange, onNext, isSubmitting, onBack }: { value: string[]; onChange: (v: string[]) => void; onNext: () => void; isSubmitting: boolean; onBack: () => void }) {
  const toggle = (k: string) => {
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k]);
  };

  return (
    <OnbChrome step={3} total={5} onBack={onBack} cta={
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="var(--hh-ink-900)" strokeWidth={1.6}/>
        </button>
        <div style={{ flex: 1 }}>
          <CtaPrimary onClick={onNext} disabled={value.length < 2 || isSubmitting}>
            Continue <Arrow/>
          </CtaPrimary>
        </div>
      </div>
    }>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 03 · Your hand</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          What pulls you<br/><span style={{ fontStyle: "italic" }}>to a city?</span>
        </div>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: "var(--hh-ink-700)" }}>Pick at least two. The guide will thread them through your days.</p>
      </div>

      <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {INTEREST_ITEMS.map(({ k, label, hint }) => {
          const active = value.includes(k);
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              style={{ cursor: "pointer", padding: "14px 10px 12px", borderRadius: 16, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: active ? "1px solid var(--hh-ink-900)" : "0.5px solid var(--hh-linen-300)", color: active ? "var(--hh-linen-50)" : "var(--hh-ink-900)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", boxShadow: active ? "0 6px 16px rgba(26,22,17,0.14)" : "none", transition: "background 0.15s, color 0.15s" }}
            >
              {(() => { const Icon = CATEGORY_ICON[k]; return Icon ? <Icon size={22} color={active ? "rgba(250,247,241,0.9)" : "var(--hh-stone-500)"} strokeWidth={1.4}/> : null; })()}
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{label}</div>
              <div style={{ fontSize: 10, lineHeight: 1.3, color: active ? "rgba(250,247,241,0.6)" : "var(--hh-stone-500)" }}>{hint}</div>
            </button>
          );
        })}
      </div>

    </OnbChrome>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { user, authError } = useAuth();

  // Kick off the /places fetch immediately when the user lands on step 1.
  // By the time they reach the Discover step (5+ taps later), the cache is
  // populated and the deck appears instantly instead of after a 5–10 s wait.
  useEffect(() => { preloadPlaces(); }, []);

  const [step, setStep]                   = useState(1);
  const [durationDays, setDurationDays]   = useState(3);
  const [budgetLevel, setBudgetLevel]     = useState(2);
  const [pickedPlaceIds, setPickedIds]    = useState<string[]>([]);
  const [interests, setInterests]         = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  // Step 2: arrival & departure
  const [arrivalDate, setArrivalDate]       = useState("");
  const [arrivalTime, setArrivalTime]       = useState("");
  const [departureDate, setDepartureDate]   = useState("");
  const [departureTime, setDepartureTime]   = useState("");

  // Step 5: accommodation
  const [accName, setAccName]               = useState("");
  const [accAddress, setAccAddress]         = useState("");
  const [accLat, setAccLat]                 = useState<number | null>(null);
  const [accLng, setAccLng]                 = useState<number | null>(null);

  // Keep duration in sync with picked dates
  useEffect(() => {
    if (arrivalDate && departureDate) {
      const days = Math.max(1, differenceInCalendarDays(parseISO(departureDate), parseISO(arrivalDate)));
      setDurationDays(days);
    }
  }, [arrivalDate, departureDate]);

  // Pre-fill departure when arrival changes and duration is set
  const handleArrivalChange = (v: string) => {
    setArrivalDate(v);
    if (v && !departureDate) {
      setDepartureDate(defaultDepartureIso(v, durationDays));
    }
  };

  const handleAccommodationSelect = (r: AccommodationResult) => {
    if (!r.name) { setAccName(""); setAccAddress(""); setAccLat(null); setAccLng(null); return; }
    setAccName(r.name);
    setAccAddress(r.address);
    setAccLat(r.lat);
    setAccLng(r.lng);
  };

  const handleSkipAccommodation = () => {
    // Default to Rautatientori (city centre). Jump past accommodation to step 3 (Interests).
    setAccName("");
    setAccAddress("");
    setAccLat(60.1699);
    setAccLng(24.9384);
    setStep(3);
  };

  const handleSubmit = async (finalPickedIds: string[]) => {
    console.log("[handleSubmit] user:", user?.id ?? "NULL", "isSubmitting:", isSubmitting);
    if (isSubmitting) return;
    if (!user) {
      setSubmitError(`Kirjautuminen ei onnistunut${authError ? `: ${authError}` : ""}. Lataa sivu uudelleen.`);
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const supabase = createClient();

    // Build title from dates if available, fallback to days
    const tripTitle = arrivalDate
      ? `Helsinki · ${format(parseISO(arrivalDate), "MMM yyyy")}`
      : `Helsinki · ${durationDays} ${durationDays === 1 ? "day" : "days"}`;

    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id:               user.id,
        title:                 tripTitle,
        duration_days:         durationDays,
        budget_level:          budgetLevel,
        interests,
        status:                "planning",
        start_date:            arrivalDate || null,
        arrival_date:          arrivalDate || null,
        arrival_time:          arrivalTime || null,
        departure_date:        departureDate || null,
        departure_time:        departureTime || null,
        accommodation_name:    accName || null,
        accommodation_address: accAddress || null,
        accommodation_lat:     accLat,
        accommodation_lng:     accLng,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create trip:", error.message);
      setSubmitError("Matkan luonti epäonnistui. Yritä uudelleen.");
      setIsSubmitting(false);
      return;
    }

    await generateTripDays(
      supabase, data.id, durationDays, budgetLevel, interests, finalPickedIds,
      arrivalDate || null,
      arrivalTime || null,
      departureDate || null,
      departureTime || null,
    );
    router.push(`/trips/${data.id}`);
  };

  // Step routing — new flow:
  //   1. Arrival & departure  → 2
  //   2. Accommodation        → 3 (skip also lands on 3)
  //   3. Interests            → 4
  //   4. Budget               → 5
  //   5. Discover             → submit
  if (step === 1) return (
    <StepArrivalDeparture
      arrivalDate={arrivalDate} arrivalTime={arrivalTime}
      departureDate={departureDate} departureTime={departureTime}
      onChangeArrivalDate={handleArrivalChange}
      onChangeArrivalTime={setArrivalTime}
      onChangeDepartureDate={setDepartureDate}
      onChangeDepartureTime={setDepartureTime}
      onNext={() => setStep(2)} onBack={() => router.push("/")}
    />
  );
  if (step === 2) return (
    <StepAccommodation
      accommodationName={accName} accommodationAddress={accAddress}
      accommodationLat={accLat} accommodationLng={accLng}
      onSelect={handleAccommodationSelect}
      onSkip={handleSkipAccommodation}
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
    />
  );
  if (step === 3) return (
    <StepInterests value={interests} onChange={setInterests} onNext={() => setStep(4)} isSubmitting={isSubmitting} onBack={() => setStep(2)}/>
  );
  if (step === 4) return (
    <StepBudget value={budgetLevel} onChange={setBudgetLevel} onNext={() => setStep(5)} onBack={() => setStep(3)}/>
  );
  return (
    <StepDiscover
      budgetLevel={budgetLevel} interests={interests}
      onNext={ids => { setPickedIds(ids); handleSubmit(ids); }}
      onBack={() => setStep(4)}
      isSubmitting={isSubmitting} errorMessage={submitError}
    />
  );
}
