"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Place, Json } from "@/types/database.types";
import { Phone, Mail, Ticket } from "lucide-react";

// ── Opening hours helpers ─────────────────────────────────────
const SHORT_K = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const LONG_K  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

type DayHours = { open: string; close: string };

function parseHoursEntry(val: unknown): DayHours | null {
  if (!val) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const v = val as Record<string, unknown>;
    if (typeof v.open === "string" && typeof v.close === "string") return { open: v.open, close: v.close };
  }
  if (typeof val === "string") {
    const m = val.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (m && m[1] && m[2]) return { open: m[1], close: m[2] };
  }
  return null;
}

function getAllHours(opening_hours: Json | null): Partial<Record<string, DayHours>> | null {
  if (!opening_hours || typeof opening_hours !== "object" || Array.isArray(opening_hours)) return null;
  const h = opening_hours as Record<string, unknown>;
  const result: Partial<Record<string, DayHours>> = {};
  for (let i = 0; i < 7; i++) {
    for (const key of [SHORT_K[i], LONG_K[i], String(i), String(i + 1)]) {
      if (!key) continue;
      const entry = parseHoursEntry(h[key]);
      if (entry) { result[SHORT_K[i]] = entry; break; }
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function getTodayHours(opening_hours: Json | null): DayHours | null {
  const all = getAllHours(opening_hours);
  if (!all) return null;
  return all[SHORT_K[new Date().getDay()]] ?? null;
}

function isOpenNow(h: DayHours): boolean {
  const parse = (t: string) => { const [hh, mm] = t.split(":").map(Number); return (hh ?? 0) * 60 + (mm ?? 0); };
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  return now >= parse(h.open) && now < parse(h.close);
}

function hoursLeft(closeTime: string): string {
  const [hh, mm] = closeTime.split(":").map(Number);
  const closeMin = (hh ?? 22) * 60 + (mm ?? 0);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const diff = closeMin - nowMin;
  if (diff <= 0) return "0";
  if (diff < 60) return "<1";
  return String(Math.floor(diff / 60));
}

// ── UI constants ──────────────────────────────────────────────
const PRICE_MARK: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€" };
const PRICE_LABEL: Record<number, string> = { 1: "Budget-friendly", 2: "Mid-range", 3: "Splurge" };

const CAT_LABEL: Record<string, string> = {
  food: "Restaurant", cafe: "Café", sauna: "Sauna", nature: "Nature",
  museums: "Museum", history: "Historic site", arch: "Architecture",
  design: "Design", shop: "Shopping", night: "Nightlife",
  events: "Event", family: "Family-friendly",
};
const CAT_COLOR: Record<string, string> = {
  food: "#B65A37", cafe: "#B65A37", shop: "#B65A37",
  sauna: "#3F5A45", nature: "#3F5A45", family: "#3F5A45",
  museums: "#133A5B", history: "#133A5B", arch: "#133A5B",
  design: "#1A1611", night: "#C99544", events: "#C99544",
};

const WEEKDAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SHORT_MON = ["mon","tue","wed","thu","fri","sat","sun"] as const;

// ── Sub-components ────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[0,1,2,3,4].map(i => {
        const filled = i < Math.round(rating);
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.3 3.5H11l-3 2.2 1.3 3.5L6 8.1 2.7 10.2 4 6.7 1 4.5h3.7z"
              fill={filled ? "#C96E48" : "#DDD2BC"}
              stroke={filled ? "#C96E48" : "#DDD2BC"}
              strokeWidth="0.4" strokeLinejoin="round"/>
          </svg>
        );
      })}
    </div>
  );
}

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.1em", flex: "0 0 auto" }}>{number}</span>
      <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 24, lineHeight: 1, letterSpacing: "-0.01em", color: "var(--hh-ink-900)", fontStyle: "italic", flex: "0 0 auto" }}>{title}</span>
      <div style={{ flex: 1, height: 0.5, background: "var(--hh-linen-300)" }}/>
    </div>
  );
}

function HoursTable({ hours }: { hours: Partial<Record<string, DayHours>> }) {
  // today index where 0=Mon (convert from JS 0=Sun)
  const todayJS  = new Date().getDay();
  const todayIdx = (todayJS + 6) % 7;

  return (
    <div style={{ marginBottom: 28 }}>
      {SHORT_MON.map((key, i) => {
        const h = hours[key];
        const isToday = i === todayIdx;
        return (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid var(--hh-linen-200)" }}>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5, color: isToday ? "var(--hh-ink-900)" : "var(--hh-stone-400)", fontWeight: isToday ? 600 : 400, letterSpacing: "0.04em" }}>
              {WEEKDAYS[i]}{isToday && <span style={{ color: "var(--hh-copper-600)", marginLeft: 6 }}>· today</span>}
            </span>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11.5, color: isToday ? "var(--hh-ink-900)" : "var(--hh-stone-500)", fontWeight: isToday ? 600 : 400 }}>
              {h ? `${h.open}–${h.close}` : <span style={{ color: "var(--hh-stone-400)" }}>Closed</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PlaceInfoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from("places")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => { setPlace(data); setLoading(false); });
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "var(--hh-linen-100)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading…</div>
      </div>
    );
  }

  if (!place) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", gap: 16 }}>
        <p style={{ color: "var(--hh-stone-500)", fontFamily: "var(--font-geist-sans)" }}>Place not found.</p>
        <button onClick={() => router.back()} style={{ color: "var(--hh-ink-900)", fontFamily: "var(--font-geist-sans)", fontSize: 14, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Go back</button>
      </div>
    );
  }

  const todayHours = getTodayHours(place.opening_hours);
  const allHours   = getAllHours(place.opening_hours);
  const openNow    = todayHours ? isOpenNow(todayHours) : null;
  const tags       = (place.tags as string[]) ?? [];
  const catLabel   = CAT_LABEL[place.category] ?? place.category;
  const catColor   = CAT_COLOR[place.category] ?? "#B5A992";

  const directionsUrl = place.address
    ? `https://maps.google.com/?q=${encodeURIComponent(place.address + ", Helsinki")}`
    : `https://maps.google.com/?q=${place.lat},${place.lng}`;

  let sectionIdx = 0;
  const nextSection = () => { sectionIdx++; return String(sectionIdx).padStart(2, "0"); };

  return (
    <div style={{ background: "var(--hh-linen-50)", minHeight: "100dvh", paddingBottom: 150, overflowX: "hidden" }}>

      {/* ── Hero image ─────────────────────────────────────── */}
      <div style={{ position: "relative", height: "42dvh", minHeight: 260, maxHeight: 380, overflow: "hidden", background: catColor + "33" }}>
        {place.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image_url}
            alt={place.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        )}
        {/* gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,15,25,0.38) 0%, transparent 45%, rgba(10,15,25,0.12) 100%)" }}/>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{ position: "absolute", top: "max(52px, calc(env(safe-area-inset-top, 0px) + 20px))", left: 20, width: 40, height: 40, borderRadius: 999, background: "rgba(10,15,25,0.48)", border: "none", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Main card — overlaps hero ─────────────────────── */}
      <div style={{ position: "relative", marginTop: -40, background: "var(--hh-linen-50)", borderRadius: "24px 24px 0 0", minHeight: "calc(58dvh + 40px)" }}>

        {/* drag pill */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--hh-linen-300)" }}/>
        </div>

        <div style={{ padding: "12px 20px 0" }}>

          {/* Category dot + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: 999, background: catColor, flex: "0 0 auto" }}/>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-stone-500)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              {catLabel}
              {place.price_level && (
                <span style={{ color: "var(--hh-linen-300)" }}> · {PRICE_MARK[place.price_level]}</span>
              )}
            </span>
          </div>

          {/* Name + rating */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
            <h1 style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 0.95, letterSpacing: "-0.025em", color: "var(--hh-ink-900)", margin: 0, fontWeight: 400, fontStyle: "italic" }}>
              {place.name}.
            </h1>
            {place.rating && (
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: 6, gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <StarRating rating={place.rating}/>
                  <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 600, color: "var(--hh-copper-600)" }}>
                    {place.rating.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Address */}
          {place.address && (
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-400)", letterSpacing: "0.03em", marginBottom: 16, lineHeight: 1.5 }}>
              {place.address}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 0.5, background: "var(--hh-linen-300)", marginBottom: 14 }}/>

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 20 }}>
              {tags.map(tag => (
                <span
                  key={tag}
                  style={{ border: "0.5px solid var(--hh-linen-300)", borderRadius: 999, padding: "6px 13px", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-ink-700)", background: "var(--hh-linen-50)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Info boxes row ────────────────────────────────── */}
        {(todayHours || place.price_level) && (
          <div style={{ display: "flex", gap: 10, padding: "0 20px 20px", background: "var(--hh-linen-50)" }}>

            {/* Open / Closed */}
            {todayHours && (
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 18, background: "var(--hh-linen-100)", border: "0.5px solid var(--hh-linen-300)" }}>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
                  {openNow ? "Open now" : "Closed"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 999, background: openNow ? "#3F5A45" : "#B65A37", flex: "0 0 auto" }}/>
                  <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 600, color: "var(--hh-ink-900)" }}>
                    Until {todayHours.close}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)" }}>
                  {openNow
                    ? `${hoursLeft(todayHours.close)}h left today`
                    : `Opens at ${todayHours.open}`}
                </div>
              </div>
            )}

            {/* Budget */}
            {place.price_level && (
              <div style={{ flex: 1, padding: "14px 16px", borderRadius: 18, background: "#D4E8D4", border: "0.5px solid #B8C9B6" }}>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(26,22,17,0.5)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>
                  Budget
                </div>
                <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, lineHeight: 1, color: "#1A1611", marginBottom: 5 }}>
                  {PRICE_MARK[place.price_level]}
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(26,22,17,0.55)" }}>
                  {PRICE_LABEL[place.price_level]}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Sections ─────────────────────────────────────── */}
        <div style={{ padding: "0 20px", background: "var(--hh-linen-50)" }}>

          {/* Description */}
          {place.description && (
            <>
              <SectionHeader number={nextSection()} title="Why this"/>
              <p style={{ fontFamily: "var(--font-geist-sans)", fontSize: 15, lineHeight: 1.7, color: "var(--hh-ink-700)", margin: "0 0 28px" }}>
                {place.description}
              </p>
            </>
          )}

          {/* Hours table */}
          {allHours && Object.keys(allHours).length > 0 && (
            <>
              <SectionHeader number={nextSection()} title="Hours"/>
              <HoursTable hours={allHours}/>
            </>
          )}

          {/* Pricing info */}
          {place.pricing_info && (
            <>
              <SectionHeader number={nextSection()} title="Pricing"/>
              <p style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14.5, lineHeight: 1.65, color: "var(--hh-ink-700)", margin: "0 0 28px", whiteSpace: "pre-wrap" }}>
                {place.pricing_info}
              </p>
            </>
          )}

          {/* Contact */}
          {(place.phone || place.email) && (
            <>
              <SectionHeader number={nextSection()} title="Contact"/>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {place.phone && (
                  <a
                    href={`tel:${place.phone.replace(/\s+/g, "")}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-ink-900)", textDecoration: "none" }}
                  >
                    <Phone size={14} color="var(--hh-stone-500)" strokeWidth={1.7}/>
                    <span>{place.phone}</span>
                  </a>
                )}
                {place.email && (
                  <a
                    href={`mailto:${place.email}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-ink-900)", textDecoration: "none" }}
                  >
                    <Mail size={14} color="var(--hh-stone-500)" strokeWidth={1.7}/>
                    <span>{place.email}</span>
                  </a>
                )}
              </div>
            </>
          )}

          {/* Reservation CTA */}
          {place.reservation_url && (
            <>
              <SectionHeader number={nextSection()} title="Reserve"/>
              <a
                href={place.reservation_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "12px 20px", borderRadius: 999,
                  background: "var(--hh-ink-900)", color: "#FAF7F1",
                  fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500,
                  textDecoration: "none", marginBottom: 28,
                  boxShadow: "0 2px 12px rgba(26,22,17,0.18)",
                }}
              >
                <Ticket size={15} strokeWidth={1.7}/>
                <span>Varaa / osta lippu</span>
              </a>
            </>
          )}

          {/* Website link */}
          {place.website && (
            <>
              <SectionHeader number={nextSection()} title="More info"/>
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-baltic-700)", letterSpacing: "0.04em", marginBottom: 28, textDecoration: "none", borderBottom: "0.5px solid var(--hh-baltic-200)", paddingBottom: 2 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1.5 6h9M6 1.5c1.5 1.8 1.5 7.2 0 9M6 1.5c-1.5 1.8-1.5 7.2 0 9" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                {place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </>
          )}

        </div>
      </div>

      {/* ── Sticky bottom CTAs (above BottomNav) ──────────── */}
      <div style={{
        position: "fixed", bottom: 68, left: 0, right: 0,
        padding: "12px 20px",
        paddingBottom: "12px",
        background: "rgba(250,247,241,0.96)",
        borderTop: "0.5px solid var(--hh-linen-300)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex", gap: 10,
        zIndex: 40,
      }}>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, height: 54, borderRadius: 28,
            border: "1px solid var(--hh-linen-300)",
            background: "transparent",
            color: "var(--hh-ink-900)",
            fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.2A3.8 3.8 0 003.2 5c0 3 3.8 7.8 3.8 7.8S10.8 8 10.8 5A3.8 3.8 0 007 1.2zm0 5.2a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8z" fill="var(--hh-ink-900)"/>
          </svg>
          Get directions →
        </a>
        <button
          onClick={() => router.back()}
          style={{
            flex: 1, height: 54, borderRadius: 28, border: "none",
            background: "var(--hh-copper-600)",
            color: "#FAF7F1",
            fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(182,90,55,0.28)",
          }}
        >
          + Add to list
        </button>
      </div>
    </div>
  );
}
