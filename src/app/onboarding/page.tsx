"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

// ── Shared chrome ────────────────────────────────────────────
function OnbChrome({ children, step, total = 3 }: { children: React.ReactNode; step: number; total?: number }) {
  return (
    <div style={{ width: "100%", minHeight: "100dvh", position: "relative", background: "var(--hh-linen-100)", color: "var(--hh-ink-700)", fontFamily: "var(--font-geist-sans)", overflowX: "hidden" }}>
      {/* paper grain */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.5, pointerEvents: "none", backgroundImage: "radial-gradient(rgba(58,52,43,0.045) 1px, transparent 1px)", backgroundSize: "3px 3px", zIndex: 0 }}/>

      {/* top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10, padding: "56px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-50)", display: "grid", placeItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M10 3.5L5.5 8L10 12.5" stroke="var(--hh-ink-900)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--hh-ink-900)" }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.25" fill="none" stroke="var(--hh-ink-900)" strokeWidth="1.25"/><circle cx="7" cy="7" r="2" fill="var(--hh-ink-900)"/></svg>
            <span>hello<span style={{ opacity: 0.55 }}>·</span>hel</span>
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>
            0{step} / 0{total}
          </div>
        </div>
        {/* progress bar */}
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: total }, (_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "var(--hh-ink-900)" : "var(--hh-linen-300)", transition: "background 0.2s" }}/>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, paddingTop: 132 }}>
        {children}
      </div>
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

// ── Step 1 — Trip length (TripLengthB chip grid) ─────────────
const DURATION_OPTIONS = [
  { n: 1, label: "A long afternoon", sub: "Highlights, one neighbourhood" },
  { n: 2, label: "A weekend",         sub: "City + one island" },
  { n: 3, label: "A proper visit",    sub: "City, sea, sauna" },
  { n: 4, label: "Time to wander",    sub: "Off-grid finds, day trip" },
  { n: 5, label: "Five slow days",    sub: "Live a little Helsinki" },
  { n: 7, label: "A week+",           sub: "Lapland · Porvoo · Tampere" },
];

function StepDuration({ value, onChange, onNext }: { value: number; onChange: (n: number) => void; onNext: () => void }) {
  return (
    <OnbChrome step={1}>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 02 · The shape of it</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          How long are you<br/><span style={{ fontStyle: "italic" }}>here for?</span>
        </div>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: "var(--hh-ink-700)", maxWidth: 320 }}>
          Pick a shape. You can always add or trim days later.
        </p>
      </div>

      <div style={{ padding: "24px 24px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DURATION_OPTIONS.map(o => {
          const active = value === o.n;
          return (
            <button
              key={o.n}
              onClick={() => onChange(o.n)}
              style={{ textAlign: "left", cursor: "pointer", padding: "16px 16px 14px", borderRadius: 18, background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", border: active ? "1px solid var(--hh-ink-900)" : "0.5px solid var(--hh-linen-300)", color: active ? "var(--hh-linen-50)" : "var(--hh-ink-900)", position: "relative", minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: active ? "0 8px 22px rgba(26,22,17,0.18)" : "none", transition: "background 0.15s, color 0.15s" }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 0.9, letterSpacing: "-0.04em" }}>{o.n}</span>
                {o.n === 7 && <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontStyle: "italic", fontSize: 30, lineHeight: 0.9 }}>+</span>}
                <span style={{ marginLeft: 4, fontFamily: "var(--font-geist-mono)", fontSize: 10.5, letterSpacing: "0.06em", opacity: 0.7, paddingBottom: 4 }}>{o.n === 1 ? "day" : "days"}</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500, lineHeight: 1.2, marginBottom: 3 }}>{o.label}</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.35, opacity: active ? 0.65 : 0.7, color: active ? "var(--hh-linen-200)" : "var(--hh-stone-500)" }}>{o.sub}</div>
              </div>
              {active && (
                <div style={{ position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: 999, background: "var(--hh-copper-600)", display: "grid", placeItems: "center" }}>
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden><path d="M1 4.5L4 7.5L10 1" stroke="#FAF7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "20px 24px 56px" }}>
        <CtaPrimary onClick={onNext}>Continue <Arrow/></CtaPrimary>
      </div>
    </OnbChrome>
  );
}

// ── Step 2 — Budget (BudgetA stacked cards) ──────────────────
const BUDGET_TIERS = [
  { n: 1, mark: "€",   title: "Coffee-shop curious", spend: "€30–60",  pitch: "Public saunas, market hall lunches, the kind of day you wear out your shoes.", moments: [{ name: "Cinnamon bun · Sävy", price: "€4.50" }, { name: "Allas pools · daysplash", price: "€16" }, { name: "Suomenlinna ferry", price: "€3.10" }], tint: "var(--hh-moss-700)" },
  { n: 2, mark: "€€",  title: "A proper day out",   spend: "€70–150", pitch: "Long lunches, design shops, a private sauna shift, maybe a ferry to dinner.", moments: [{ name: "Lunch at Story", price: "€26" }, { name: "Marimekko · Outlet", price: "€85" }, { name: "Löyly · evening sauna", price: "€22" }], tint: "var(--hh-copper-600)" },
  { n: 3, mark: "€€€", title: "Treat yourself",     spend: "€180+",   pitch: "Tasting menus, private island saunas, taxi-boats, the long table by the window.", moments: [{ name: "Tasting at Olo", price: "€189" }, { name: "Lonna · private sauna", price: "€420" }, { name: "Room · Hotel Maria", price: "€340" }], tint: "var(--hh-baltic-700)" },
] as const;

function StepBudget({ value, onChange, onNext, onBack }: { value: number; onChange: (n: number) => void; onNext: () => void; onBack: () => void }) {
  return (
    <OnbChrome step={2}>
      <div style={{ padding: "0 24px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-500)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>Chapter 03 · Money talk</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 42, lineHeight: 0.96, letterSpacing: "-0.022em", color: "var(--hh-ink-900)" }}>
          What&apos;s your <span style={{ fontStyle: "italic" }}>appetite?</span>
        </div>
        <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5, color: "var(--hh-ink-700)", maxWidth: 320 }}>
          Helsinki is generous to careful spenders and rewards a splurge.
        </p>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {BUDGET_TIERS.map(t => {
          const active = t.n === value;
          return (
            <button
              key={t.n}
              onClick={() => onChange(t.n)}
              style={{ textAlign: "left", cursor: "pointer", padding: 0, border: active ? "1px solid var(--hh-ink-900)" : "0.5px solid var(--hh-linen-300)", borderRadius: 18, overflow: "hidden", background: active ? "var(--hh-ink-900)" : "var(--hh-linen-50)", color: active ? "var(--hh-linen-50)" : "var(--hh-ink-900)", boxShadow: active ? "0 14px 32px rgba(10,31,51,0.22)" : "none", transition: "all 0.2s", display: "flex", flexDirection: "column" }}
            >
              {/* top row */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                <div style={{ width: 54, height: 54, borderRadius: 12, background: active ? t.tint : "var(--hh-linen-200)", color: active ? "var(--hh-linen-50)" : t.tint, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                  <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: t.n === 3 ? 22 : 28, lineHeight: 0.85, letterSpacing: "-0.04em", fontStyle: t.n === 3 ? "italic" : "normal" }}>{t.mark}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 15.5, fontWeight: 500, lineHeight: 1.15 }}>{t.title}</div>
                  <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, letterSpacing: "0.06em", marginTop: 3, color: active ? "var(--hh-linen-200)" : "var(--hh-stone-500)" }}>{t.spend} / day · per person</div>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: active ? "var(--hh-copper-600)" : "transparent", border: active ? "none" : "1.5px solid var(--hh-linen-300)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                  {active && <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden><path d="M1 4.5L4 7.5L10 1" stroke="#FAF7F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>

              {/* expanded content */}
              {active && (
                <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 18, lineHeight: 1.25, letterSpacing: "-0.01em", color: "var(--hh-linen-50)", fontStyle: "italic" }}>
                    &ldquo;{t.pitch}&rdquo;
                  </div>
                  <div style={{ borderTop: "0.5px solid rgba(250,247,241,0.18)", paddingTop: 10 }}>
                    {t.moments.map((m, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBlock: 4 }}>
                        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "var(--hh-linen-50)" }}>{m.name}</span>
                        <div style={{ flex: 1, borderBottom: "1px dotted rgba(250,247,241,0.35)", transform: "translateY(-3px)" }}/>
                        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-linen-50)", letterSpacing: "0.02em" }}>{m.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 24px 56px", display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", height: 60, padding: "0 20px", borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", color: "var(--hh-ink-900)", fontFamily: "var(--font-geist-sans)", fontSize: 16, cursor: "pointer" }}>←</button>
        <div style={{ flex: 1 }}><CtaPrimary onClick={onNext}>Continue <Arrow/></CtaPrimary></div>
      </div>
    </OnbChrome>
  );
}

// ── Step 3 — Interests (InterestsA icon grid) ────────────────
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

// Simple category glyphs — Unicode symbols as placeholders
const CATEGORY_GLYPHS: Record<string, string> = {
  food: "🍽", sauna: "♨", museums: "🏛", design: "◎",
  nature: "🌿", night: "🍸", arch: "⬡", shop: "◻",
  family: "👨‍👩‍👧", history: "⏱", cafe: "☕", events: "◈",
};

function StepInterests({ value, onChange, onSubmit, isSubmitting, onBack }: { value: string[]; onChange: (v: string[]) => void; onSubmit: () => void; isSubmitting: boolean; onBack: () => void }) {
  const toggle = (k: string) => {
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k]);
  };

  return (
    <OnbChrome step={3}>
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
              <span style={{ fontSize: 22 }}>{CATEGORY_GLYPHS[k]}</span>
              <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: 500, lineHeight: 1.2 }}>{label}</div>
              <div style={{ fontSize: 10, lineHeight: 1.3, color: active ? "rgba(250,247,241,0.6)" : "var(--hh-stone-500)" }}>{hint}</div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "0 24px 56px", display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", height: 60, padding: "0 20px", borderRadius: 28, border: "1px solid var(--hh-linen-300)", background: "transparent", color: "var(--hh-ink-900)", fontFamily: "var(--font-geist-sans)", fontSize: 16, cursor: "pointer" }}>←</button>
        <div style={{ flex: 1 }}>
          <CtaPrimary onClick={onSubmit} disabled={value.length < 2 || isSubmitting}>
            {isSubmitting ? "Creating…" : "Build my Helsinki"} {!isSubmitting && <Arrow/>}
          </CtaPrimary>
        </div>
      </div>
    </OnbChrome>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [durationDays, setDurationDays] = useState(3);
  const [budgetLevel, setBudgetLevel] = useState(2);
  const [interests, setInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        title: `Helsinki · ${durationDays} ${durationDays === 1 ? "day" : "days"}`,
        duration_days: durationDays,
        budget_level: budgetLevel,
        interests,
        status: "planning",
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create trip:", error.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/trips/${data.id}`);
  };

  if (step === 1) return <StepDuration value={durationDays} onChange={setDurationDays} onNext={() => setStep(2)}/>;
  if (step === 2) return <StepBudget value={budgetLevel} onChange={setBudgetLevel} onNext={() => setStep(3)} onBack={() => setStep(1)}/>;
  return <StepInterests value={interests} onChange={setInterests} onSubmit={handleSubmit} isSubmitting={isSubmitting} onBack={() => setStep(2)}/>;
}
