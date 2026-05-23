"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Utensils, Flame, Landmark, Gem, TreePine, Moon,
  Building2, ShoppingBag, Users, History, Coffee, CalendarDays, ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { generateTripDays } from "@/lib/trip-generator";
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
const DURATION_STEPS = [1, 2, 3, 4, 5, 6, 7];

const DAY_PREVIEWS: Record<number, Array<{ title: string; places: string }>> = {
  1: [{ title: "The whole city in a day", places: "Cathedral · Amos Rex · Löyly" }],
  2: [{ title: "City centre & sea", places: "Kauppatori · Suomenlinna" }, { title: "Design & neighbourhoods", places: "Artek · Kallio" }],
  3: [{ title: "Centre & harbour", places: "Market Hall · Katajanokka" }, { title: "Archipelago & saunas", places: "Suomenlinna · Löyly" }, { title: "Design & local life", places: "Marimekko · Kallio" }],
  4: [{ title: "Arrival & Market Square", places: "Kauppatori · Cathedral" }, { title: "Archipelago day", places: "Suomenlinna · Seurasaari" }, { title: "Design District", places: "Design Museum · Artek" }, { title: "Kallio & nightlife", places: "Kotiharju · Good Life" }],
  5: [{ title: "Arrival & waterfront", places: "Allas · Kauppatori" }, { title: "Suomenlinna island", places: "Ferry · fortress" }, { title: "Museums & culture", places: "Amos Rex · Kiasma" }, { title: "Design & cafés", places: "Marimekko · Sävy" }, { title: "Local neighbourhoods", places: "Kallio · Hakaniemi" }],
  6: [{ title: "Arrival & waterfront", places: "Allas · Kauppatori" }, { title: "Suomenlinna island", places: "Ferry · fortress" }, { title: "Museums & culture", places: "Amos Rex · Kiasma" }, { title: "Design & cafés", places: "Marimekko · Sävy" }, { title: "Local neighbourhoods", places: "Kallio · Hakaniemi" }, { title: "Your way", places: "Porvoo · day trip" }],
  7: [{ title: "Arrival & orientation", places: "Market Square · waterfront" }, { title: "Archipelago & Suomenlinna", places: "Fortress · sea swimming" }, { title: "Museums & Kiasma", places: "Amos Rex · HAM" }, { title: "Design District & shopping", places: "Marimekko · Artek" }, { title: "Saunas & sea", places: "Löyly · Kotiharju" }, { title: "Kallio & food scene", places: "Good Life · Hakaniemi" }, { title: "Your way", places: "Porvoo · Lapland" }],
};

const DAY_DOT_COLORS = ["var(--hh-copper-600)", "var(--hh-baltic-700)", "var(--hh-moss-700)", "var(--hh-copper-600)", "var(--hh-baltic-700)", "var(--hh-moss-700)", "var(--hh-copper-600)"];

function DurationSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const idx = DURATION_STEPS.indexOf(value);
  const pct = (idx / (DURATION_STEPS.length - 1)) * 100;
  return (
    <div style={{ padding: "16px 0 4px" }}>
      <div style={{ position: "relative", height: 3, borderRadius: 2, background: "var(--hh-linen-300)", margin: "0 8px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "var(--hh-ink-900)", borderRadius: 2 }}/>
        {DURATION_STEPS.map((s, i) => {
          const pos = (i / (DURATION_STEPS.length - 1)) * 100;
          const active = s === value;
          return (
            <button key={s} onClick={() => onChange(s)} style={{ position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%, -50%)", width: active ? 22 : 10, height: active ? 22 : 10, borderRadius: 999, background: active ? "var(--hh-copper-600)" : i < idx ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: active ? "none" : i < idx ? "none" : "1.5px solid var(--hh-linen-300)", cursor: "pointer", zIndex: active ? 2 : 1, transition: "all 0.15s", padding: 0 }}/>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
        {DURATION_STEPS.map(s => (
          <span key={s} onClick={() => onChange(s)} style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: s === value ? "var(--hh-ink-900)" : "var(--hh-stone-400)", letterSpacing: "0.06em", fontWeight: s === value ? 600 : 400, cursor: "pointer", userSelect: "none" }}>
            {s === 7 ? "7+" : s}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepDuration({ value, onChange, onNext, onBack }: { value: number; onChange: (n: number) => void; onNext: () => void; onBack?: () => void }) {
  const previews = DAY_PREVIEWS[value] ?? DAY_PREVIEWS[3];
  return (
    <OnbChrome step={2} total={4} onBack={onBack} cta={<CtaPrimary onClick={onNext}>Continue <Arrow/></CtaPrimary>}>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 02 · The shape of it</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          How many days<br/><span style={{ fontStyle: "italic" }}>with us?</span>
        </div>
      </div>

      {/* Big number + arc hint */}
      <div style={{ padding: "28px 24px 4px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 112, lineHeight: 0.82, letterSpacing: "-0.04em", color: "var(--hh-ink-900)" }}>{value}</span>
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 22, color: "var(--hh-ink-700)", marginBottom: 10 }}>days</span>
        </div>
        <div style={{ paddingBottom: 14, textAlign: "right" }}>
          <svg width="52" height="36" viewBox="0 0 52 36" fill="none" aria-hidden>
            <path d="M4 33 A22 22 0 0 1 48 33" stroke="var(--hh-linen-300)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <circle cx="48" cy="33" r="5" fill="var(--hh-copper-600)"/>
          </svg>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.08em", marginTop: 4 }}>≈ {value * 8}h of Helsinki</div>
        </div>
      </div>

      {/* Scrubber */}
      <div style={{ padding: "0 24px" }}>
        <DurationSlider value={value} onChange={onChange}/>
      </div>

      {/* Preview day cards */}
      <div style={{ marginTop: 28 }}>
        <div style={{ padding: "0 24px 12px", fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          A taste of what {value} {value === 1 ? "day" : "days"} could look like
        </div>
        <div style={{ overflowX: "auto", display: "flex", gap: 10, paddingLeft: 24, paddingRight: 24, paddingBottom: 4, scrollbarWidth: "none" }}>
          {previews.map((day, i) => (
            <div key={i} style={{ flex: "0 0 auto", width: 158, padding: "14px 14px 16px", borderRadius: 16, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 999, background: DAY_DOT_COLORS[i % DAY_DOT_COLORS.length], flex: "0 0 auto" }}/>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-500)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Day {i + 1}</div>
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, lineHeight: 1.1, letterSpacing: "-0.01em", color: "var(--hh-ink-900)", marginBottom: 6 }}>{day.title}</div>
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "var(--hh-stone-500)", lineHeight: 1.35 }}>{day.places}</div>
            </div>
          ))}
        </div>
      </div>

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
  const pct = ((value - 1) / 2) * 100;
  return (
    <div style={{ padding: "8px 0 4px" }}>
      <div style={{ position: "relative", height: 3, borderRadius: 2, background: "var(--hh-linen-300)", margin: "0 8px" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: "var(--hh-ink-900)", borderRadius: 2 }}/>
        {[1, 2, 3].map((s, i) => {
          const pos = (i / 2) * 100;
          const active = s === value;
          return (
            <button key={s} onClick={() => onChange(s)} style={{ position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%, -50%)", width: active ? 22 : 10, height: active ? 22 : 10, borderRadius: 999, background: active ? "var(--hh-copper-600)" : i < value - 1 ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: active ? "none" : i < value - 1 ? "none" : "1.5px solid var(--hh-linen-300)", cursor: "pointer", zIndex: active ? 2 : 1, transition: "all 0.15s", padding: 0 }}/>
          );
        })}
      </div>
    </div>
  );
}

function StepBudget({ value, onChange, onNext, onBack }: { value: number; onChange: (n: number) => void; onNext: () => void; onBack: () => void }) {
  const tier = BUDGET_TIERS[value - 1];
  return (
    <OnbChrome step={3} total={4} onBack={onBack} cta={
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <ChevronLeft size={20} color="var(--hh-ink-900)" strokeWidth={1.6}/>
        </button>
        <div style={{ flex: 1 }}><CtaPrimary onClick={onNext}>Continue <Arrow/></CtaPrimary></div>
      </div>
    }>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 03 · Money talk</div>
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
  const [deck, setDeck]       = useState<Place[]>([]);
  const [idx, setIdx]         = useState(0);
  const [picked, setPicked]   = useState<string[]>([]);
  const [exiting, setExiting] = useState(false);
  const [round, setRound]     = useState(1);
  const headlineRef           = useState(() => DISCOVER_HEADLINES[Math.floor(Math.random() * DISCOVER_HEADLINES.length)])[0];

  useEffect(() => {
    const INTEREST_CATEGORIES: Record<string, string[]> = {
      food: ["food", "cafe"], sauna: ["sauna"], museums: ["museums"],
      design: ["design", "shop"], nature: ["nature"], night: ["night"],
      arch: ["arch"], shop: ["shop"], family: ["nature", "museums"],
      history: ["history"], cafe: ["cafe"], events: ["museums"],
    };
    const wantedCategories = new Set(interests.flatMap(i => INTEREST_CATEGORIES[i] ?? []));

    createClient()
      .from("places")
      .select("*")
      .then(({ data, error }) => {
        if (error) { console.error("Discover fetch error:", error.message); return; }
        if (data) {
          const filtered = data.filter(p => (p.price_level ?? 1) <= budgetLevel);
          // Sort: interest-matching places first, then random within each group
          const matched   = filtered.filter(p => wantedCategories.has(p.category)).sort(() => Math.random() - 0.5);
          const unmatched = filtered.filter(p => !wantedCategories.has(p.category)).sort(() => Math.random() - 0.5);
          setDeck([...matched, ...unmatched]);
        }
      });
  }, [budgetLevel, interests]);

  const advance = useCallback((addCurrent: boolean) => {
    const place = deck[idx];
    if (addCurrent && place) setPicked(p => [...p, place.id]);

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

  const current  = deck[idx];
  const nextCard = deck[idx + 1] ?? deck[0];

  if (!current) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "var(--hh-linen-100)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading picks…</div>
      </div>
    );
  }

  const imgSrc   = PLACE_IMAGES[current.name] ?? "/assets/helsinki-cathedral-alley.jpg";
  const nextImg  = PLACE_IMAGES[nextCard?.name ?? ""] ?? "/assets/helsinki-cathedral-alley.jpg";
  const catLabel = CATEGORY_LABEL_UPPER[current.category] ?? current.category.toUpperCase();
  const tags     = (current.tags as string[]).slice(0, 3);

  return (
    <div style={{ width: "100%", minHeight: "100dvh", background: "var(--hh-linen-100)", display: "flex", flexDirection: "column", padding: "56px 20px 32px", boxSizing: "border-box" }}>
      {/* paper grain */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(58,52,43,0.045) 1px, transparent 1px)", backgroundSize: "3px 3px", zIndex: 0 }}/>

      {/* header row */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          hello·hel · curated · round {String(round).padStart(2, "0")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--hh-ink-900)", borderRadius: 999, padding: "5px 12px" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z" fill="#FAF7F1"/></svg>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, color: "var(--hh-linen-50)", letterSpacing: "0.08em", fontWeight: 600 }}>{String(picked.length).padStart(2, "0")} on list</span>
        </div>
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
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {/* back card (next) */}
        {nextCard && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", transform: "scale(0.94) translateY(12px)", zIndex: 0 }}>
            <img src={nextImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,241,0.15)" }}/>
          </div>
        )}

        {/* front card */}
        <div style={{
          position: "relative", zIndex: 1,
          borderRadius: 24, overflow: "hidden",
          height: "min(480px, 62dvh)",
          transform: exiting ? "scale(0.9) translateY(-30px)" : "scale(1) translateY(0)",
          opacity: exiting ? 0 : 1,
          transition: "transform 0.22s ease, opacity 0.22s ease",
          boxShadow: "0 16px 48px rgba(26,22,17,0.22)",
        }}>
          {/* image */}
          <img src={imgSrc} alt={current.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>

          {/* top row overlay */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ background: "rgba(26,22,17,0.72)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "5px 12px" }}>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "#FAF7F1", letterSpacing: "0.12em" }}>● {catLabel}</span>
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

      {/* action buttons */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 20 }}>
        <button onClick={onBack} style={{ width: 52, height: 52, borderRadius: 999, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L6 8l4 5" stroke="var(--hh-stone-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>

        <button onClick={() => advance(false)} style={{ width: 52, height: 52, borderRadius: 999, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="var(--hh-stone-500)" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>

        <button onClick={() => advance(true)} style={{ height: 52, padding: "0 28px", borderRadius: 999, background: "var(--hh-copper-600)", border: "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 6px 20px rgba(182,90,55,0.38)" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="#FAF7F1" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, color: "#FAF7F1" }}>Add to list</span>
        </button>

        <button onClick={() => advance(true)} style={{ width: 52, height: 52, borderRadius: 999, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13.5S2 9.5 2 5.5a3.5 3.5 0 017 0 3.5 3.5 0 017 0c0 4-6 8-6 8z" stroke="var(--hh-stone-500)" strokeWidth="1.3"/></svg>
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
    <OnbChrome step={3} total={4} onBack={onBack} cta={
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
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 04 · Your hand</div>
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
  const { user } = useAuth();

  const [step, setStep]                   = useState(1);
  const [durationDays, setDurationDays]   = useState(3);
  const [budgetLevel, setBudgetLevel]     = useState(2);
  const [pickedPlaceIds, setPickedIds]    = useState<string[]>([]);
  const [interests, setInterests]         = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  const handleSubmit = async (finalPickedIds: string[]) => {
    console.log("[handleSubmit] user:", user?.id ?? "NULL", "isSubmitting:", isSubmitting);
    if (isSubmitting) return;
    if (!user) {
      setSubmitError("Kirjautuminen ei onnistunut. Lataa sivu uudelleen.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id:       user.id,
        title:         `Helsinki · ${durationDays} ${durationDays === 1 ? "day" : "days"}`,
        duration_days: durationDays,
        budget_level:  budgetLevel,
        interests,
        status:        "planning",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create trip:", error.message);
      setSubmitError("Matkan luonti epäonnistui. Yritä uudelleen.");
      setIsSubmitting(false);
      return;
    }

    await generateTripDays(supabase, data.id, durationDays, budgetLevel, interests, finalPickedIds);
    router.push(`/trips/${data.id}`);
  };

  if (step === 1) return <StepDuration value={durationDays} onChange={setDurationDays} onNext={() => setStep(2)} onBack={() => router.push("/")}/>;
  if (step === 2) return <StepBudget value={budgetLevel} onChange={setBudgetLevel} onNext={() => setStep(3)} onBack={() => setStep(1)}/>;
  if (step === 3) return <StepInterests value={interests} onChange={setInterests} onNext={() => setStep(4)} isSubmitting={isSubmitting} onBack={() => setStep(2)}/>;
  return <StepDiscover budgetLevel={budgetLevel} interests={interests} onNext={ids => { setPickedIds(ids); handleSubmit(ids); }} onBack={() => setStep(3)} isSubmitting={isSubmitting} errorMessage={submitError}/>;
}
