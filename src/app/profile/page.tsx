"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  ACHIEVEMENT_DEFS,
  getAchievementProgress,
  type CompletedCounts,
} from "@/lib/gamification";

// ── Category colours matching TripMapView ──────────────────────
const CAT_COLOR: Record<string, string> = {
  food: "#B65A37", cafe: "#B65A37", shop: "#B65A37",
  sauna: "#3F5A45", nature: "#3F5A45", family: "#3F5A45",
  museums: "#133A5B", history: "#133A5B", arch: "#133A5B",
  design: "#1A1611", night: "#C99544", events: "#C99544",
};

const CAT_ICON: Record<string, string> = {
  cafe:    `<path d="M5 7h10v6a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 9.5h1.5a1.5 1.5 0 010 3H15" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  food:    `<path d="M9 4v5a3 3 0 006 0V4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 13v6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  sauna:   `<path d="M7 18c0-6 10-6 10-11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10 18c0-4 7-4 7-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  museums: `<path d="M3 10l9-6 9 6M5 10v9h14v-9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  nature:  `<path d="M12 3l-7 12h14z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 15v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  arch:    `<path d="M7 16V11a5 5 0 0110 0v5" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  design:  `<path d="M12 3l2.5 5H19l-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3h4.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  history: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4.5l2.5 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  shop:    `<path d="M5 7h14l-1.5 9H6.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  night:   `<path d="M21 12.8A9 9 0 0111.2 3 9 9 0 1021 12.8z" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  family:  `<circle cx="9" cy="7" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="15" cy="7" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
  events:  `<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
};

// Helsinki skyline SVG path
const SKYLINE_SVG = (
  <svg width="80" height="36" viewBox="0 0 80 36" fill="none" style={{ opacity: 0.22 }}>
    <path d="M0 36V24h4v-6h4V8h2V6h4V8h2v10h4V16h2v-4h2v4h2V16h2v-4h2v4h2V14h4V8h2V6h2V8h2v6h4v-2h2v2h2v-4h2v4h4V36H0z" fill="currentColor"/>
  </svg>
);

interface PassportData {
  profile: { total_points: number; level: number; created_at: string; display_name: string | null } | null;
  tripCount: number;
  trip: { id: string; start_date: string | null; duration_days: number | null; title: string } | null;
  completedCount: number;
  totalActivities: number;
  todayPoints: number;
  dayNumber: number;
  unlockedKeys: Set<string>;
  counts: CompletedCounts;
  stamps: { id: string; name: string; category: string; completedAt: string }[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

// Circular stamp component
function PassportStamp({ name, category }: { name: string; category: string }) {
  const color   = CAT_COLOR[category] ?? "#B5A992";
  const iconSvg = CAT_ICON[category] ?? CAT_ICON.design;
  const size    = 88;
  const r       = 38;
  const cx      = size / 2;
  const cy      = size / 2;
  const rimText = (category.toUpperCase() + " · ").repeat(5);

  return (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <path id={`rim-${category}-${name.slice(0,3)}`} d={`M ${cx},${cy} m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`}/>
        </defs>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.5" opacity="0.85"/>
        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={r - 7} fill="none" stroke={color} strokeWidth="0.7" opacity="0.45"/>
        {/* Rim text */}
        <text fontSize="5.5" fill={color} fontFamily="var(--font-geist-mono)" letterSpacing="1.5" opacity="0.6">
          <textPath href={`#rim-${category}-${name.slice(0,3)}`} startOffset="0%">
            {rimText}
          </textPath>
        </text>
        {/* Icon in center */}
        <g transform={`translate(${cx - 10}, ${cy - 10})`} color={color}>
          <svg width="20" height="20" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: iconSvg }}/>
        </g>
      </svg>
      {/* Place name below stamp — up to 2 lines, no truncation with "..." forced */}
      <div style={{
        fontFamily: "var(--font-geist-mono)",
        fontSize: 9,
        fontWeight: 600,
        color,
        letterSpacing: "0.04em",
        textAlign: "center",
        lineHeight: 1.35,
        width: size,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
        overflow: "hidden",
        wordBreak: "break-word",
      }}>
        {name}
      </div>
    </div>
  );
}

export default function PassportPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const sb = createClient();

    const [profileRes, tripsRes, pointsTodayRes] = await Promise.all([
      sb.from("profiles").select("total_points, level, created_at, display_name").eq("user_id", user.id).single(),
      sb.from("trips").select("id, start_date, duration_days, title").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("points_history").select("points").eq("user_id", user.id).gte("created_at", new Date().toISOString().slice(0, 10)),
    ]);

    const trips    = tripsRes.data ?? [];
    const latestTrip = trips[0] ?? null;

    // Completed activities across all trips
    const allTripIds = trips.map(t => t.id);
    let totalActivities = 0;
    let completedCount  = 0;
    const stamps: PassportData["stamps"] = [];
    const counts: CompletedCounts = {
      cafe: 0, sauna: 0, food: 0, design: 0, arch: 0,
      suomenlinna: false, night: false, allComplete: false, total: 0,
    };

    if (allTripIds.length > 0) {
      const { data: daysData } = await sb
        .from("trip_days")
        .select("id")
        .in("trip_id", allTripIds);

      const dayIds = daysData?.map(d => d.id) ?? [];
      if (dayIds.length > 0) {
        const { data: actsData } = await sb
          .from("trip_activities")
          .select("id, completed, created_at, places(name, category, tags)")
          .in("trip_day_id", dayIds)
          .order("created_at", { ascending: false });

        totalActivities = actsData?.length ?? 0;
        const completedActs = actsData?.filter(a => a.completed) ?? [];
        completedCount = completedActs.length;
        counts.allComplete = totalActivities > 0 && completedCount === totalActivities;

        for (const act of completedActs) {
          const p = act.places as unknown as { name: string; category: string; tags: string[] } | null;
          if (!p) continue;
          if (p.category === "cafe")    counts.cafe++;
          if (p.category === "sauna")   counts.sauna++;
          if (p.category === "food")    counts.food++;
          if (p.category === "design")  counts.design++;
          if (p.category === "arch")    counts.arch++;
          if (p.category === "night")   counts.night = true;
          if (p.name?.toLowerCase().includes("suomenlinna")) counts.suomenlinna = true;
          stamps.push({ id: act.id, name: p.name, category: p.category, completedAt: act.created_at });
        }
        counts.total = completedCount;
      }
    }

    // Unlocked achievements
    const { data: unlockData } = await sb
      .from("user_achievements")
      .select("achievements(key)")
      .eq("user_id", user.id);
    const unlockedKeys = new Set(
      unlockData?.map(u => (u.achievements as unknown as { key: string } | null)?.key ?? "").filter(Boolean) ?? []
    );

    // Days in town
    let dayNumber = 1;
    if (latestTrip?.start_date) {
      const start = new Date(latestTrip.start_date);
      const today = new Date();
      dayNumber = Math.max(1, Math.min(
        Math.floor((today.getTime() - start.getTime()) / 86400000) + 1,
        latestTrip.duration_days ?? 99,
      ));
    }

    const todayPoints = pointsTodayRes.data?.reduce((s, r) => s + r.points, 0) ?? 0;

    setData({
      profile: profileRes.data,
      tripCount: trips.length,
      trip: latestTrip,
      completedCount,
      totalActivities,
      todayPoints,
      dayNumber,
      unlockedKeys,
      counts,
      stamps: stamps.slice(0, 20),
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) loadData();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, loadData]);

  if (loading || authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 68px)", background: "#F0EDE6" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "#A09880", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  const profile    = data?.profile;
  const trip       = data?.trip;
  const totalPts   = profile?.total_points ?? 0;
  const totalDays  = trip?.duration_days ?? 0;
  const dayNum     = data?.dayNumber ?? 1;
  const visited    = data?.completedCount ?? 0;
  const totalActs  = data?.totalActivities ?? 0;
  const todayPts   = data?.todayPoints ?? 0;
  const stamps     = data?.stamps ?? [];
  const unlocked   = data?.unlockedKeys ?? new Set<string>();
  const counts     = data?.counts ?? { cafe:0, sauna:0, food:0, design:0, arch:0, suomenlinna:false, night:false, allComplete:false, total:0 };

  // Pass code
  const shortId  = user?.id.slice(-4).toUpperCase() ?? "0000";
  const passCode = `HEL · ${pad2(visited)} / ${pad2(totalActs)} / ${shortId}`;

  // Issued / Expires
  const issuedStr  = profile?.created_at ? formatDate(profile.created_at) : "—";
  const expiresStr = trip?.start_date && trip.duration_days
    ? formatDate(new Date(new Date(trip.start_date).getTime() + trip.duration_days * 86400000).toISOString())
    : "Open";

  // Next badge (locked achievement closest to completion)
  const nextBadge = ACHIEVEMENT_DEFS
    .filter(d => !unlocked.has(d.key))
    .map(d => {
      const prog = getAchievementProgress(d.key, counts);
      return { def: d, prog, ratio: prog.current / prog.total };
    })
    .sort((a, b) => b.ratio - a.ratio)[0] ?? null;

  return (
    <div style={{ background: "#F0EDE6", minHeight: "calc(100dvh - 68px)", overflowY: "auto", paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 4 }}>Your Helsinki Pass</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em", color: "#1A1611", marginBottom: 20 }}>Pass.</div>
      </div>

      {/* ── Passport card ── */}
      <div style={{ margin: "0 16px 12px", background: "#FAFAF8", borderRadius: 20, border: "0.5px solid #DDD8CE", boxShadow: "0 2px 20px rgba(26,22,17,0.07)", overflow: "hidden" }}>
        {/* Top strip */}
        <div style={{ padding: "16px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="#1A1611" strokeWidth="1.2"/><circle cx="7" cy="7" r="2.2" fill="#1A1611"/></svg>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#1A1611" }}>HELLO<span style={{ color: "#A09880" }}>·</span>HEL PASSPORT</span>
          </div>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "#A09880", letterSpacing: "0.12em" }}>{passCode}</span>
        </div>

        {/* Holder */}
        <div style={{ padding: "16px 18px 0" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#A09880", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>Holder</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.01em", color: "#1A1611" }}>
            {profile?.display_name ?? `Explorer #${shortId}.`}
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "#A09880", letterSpacing: "0.06em", marginTop: 4 }}>exploring Helsinki</div>
        </div>

        {/* Dashed divider */}
        <div style={{ margin: "14px 18px", borderTop: "1.5px dashed #DDD8CE" }}/>

        {/* Bottom strip: issued / expires / skyline */}
        <div style={{ padding: "0 18px 18px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 28 }}>
            <div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 3 }}>Issued</div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 700, color: "#1A1611", letterSpacing: "0.04em" }}>{issuedStr}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 3 }}>Expires</div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 700, color: "#1A1611", letterSpacing: "0.04em" }}>{expiresStr}</div>
            </div>
          </div>
          <div style={{ color: "#1A1611" }}>{SKYLINE_SVG}</div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 8, margin: "0 16px 12px" }}>
        {/* DAYS */}
        <div style={{ flex: 1, background: "#FAFAF8", borderRadius: 16, border: "0.5px solid #DDD8CE", padding: "14px 14px 12px" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Days</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1, letterSpacing: "-0.02em", color: "#1A1611" }}>
            {pad2(dayNum)}<span style={{ fontSize: 14, color: "#A09880" }}>/{pad2(totalDays || 1)}</span>
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#A09880", letterSpacing: "0.1em", marginTop: 4 }}>in town</div>
        </div>
        {/* VISITED */}
        <div style={{ flex: 1, background: "#FAFAF8", borderRadius: 16, border: "0.5px solid #DDD8CE", padding: "14px 14px 12px" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Visited</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1, letterSpacing: "-0.02em", color: "#1A1611" }}>
            {visited}
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#A09880", letterSpacing: "0.1em", marginTop: 4 }}>of {totalActs} planned</div>
        </div>
        {/* POINTS */}
        <div style={{ flex: 1, background: "#FAFAF8", borderRadius: 16, border: "0.5px solid #DDD8CE", padding: "14px 14px 12px" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#A09880", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 6 }}>Points</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1, letterSpacing: "-0.02em", color: "#1A1611" }}>
            {totalPts}
          </div>
          {todayPts > 0 && (
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#3F5A45", letterSpacing: "0.1em", marginTop: 4 }}>+{todayPts} today</div>
          )}
          {todayPts === 0 && (
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#A09880", letterSpacing: "0.1em", marginTop: 4 }}>earned</div>
          )}
        </div>
      </div>

      {/* ── Next badge card ── */}
      {nextBadge && (
        <div style={{ margin: "0 16px 12px", background: "#B8C9B6", borderRadius: 20, padding: "18px 18px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(26,22,17,0.5)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Next Badge</div>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 15, color: "rgba(26,22,17,0.55)", fontStyle: "italic" }}>
              {nextBadge.prog.current} / {nextBadge.prog.total}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.01em", color: "#1A1611", fontStyle: "italic", marginBottom: 2 }}>
            {nextBadge.def.title}.
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "rgba(26,22,17,0.55)", letterSpacing: "0.1em", marginBottom: 14 }}>
            {nextBadge.def.titleFi}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(26,22,17,0.15)", borderRadius: 999, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(4, (nextBadge.prog.current / nextBadge.prog.total) * 100)}%`, background: "#3F5A45", borderRadius: 999, transition: "width 0.5s ease" }}/>
          </div>
          {/* Hint */}
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 13, lineHeight: 1.5, color: "rgba(26,22,17,0.65)", fontStyle: "italic" }}>
            "{nextBadge.def.hint}"
          </div>
        </div>
      )}

      {/* ── All locked? show completed state ── */}
      {!nextBadge && unlocked.size > 0 && (
        <div style={{ margin: "0 16px 12px", background: "#B8C9B6", borderRadius: 20, padding: "20px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>❤</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, color: "#1A1611", fontStyle: "italic" }}>Helsinki sydämessä.</div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(26,22,17,0.55)", letterSpacing: "0.1em", marginTop: 6 }}>All badges earned — you know Helsinki.</div>
        </div>
      )}

      {/* ── Recent stamps ── */}
      {stamps.length > 0 && (
        <div style={{ margin: "0 0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "#A09880", letterSpacing: "0.16em" }}>{pad2(stamps.length)}</span>
              <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 20, color: "#1A1611" }}>Recent stamps</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollbarWidth: "none", padding: "4px 20px 8px" }}>
            {stamps.map(s => (
              <PassportStamp key={s.id} name={s.name} category={s.category}/>
            ))}
            <div style={{ flex: "0 0 4px" }}/>
          </div>
        </div>
      )}

      {/* ── All achievements ── */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "#A09880", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>All Badges</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACHIEVEMENT_DEFS.map(a => {
            const isUnlocked = unlocked.has(a.key);
            const prog = getAchievementProgress(a.key, counts);
            return (
              <div
                key={a.key}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "13px 16px", borderRadius: 16,
                  background: isUnlocked ? "#FAFAF8" : "rgba(250,247,241,0.5)",
                  border: `0.5px solid ${isUnlocked ? "#DDD8CE" : "rgba(221,216,206,0.5)"}`,
                  opacity: isUnlocked ? 1 : 0.6,
                }}
              >
                <span style={{ fontSize: 22, flex: "0 0 auto", filter: isUnlocked ? "none" : "grayscale(1)" }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 16, color: "#1A1611", lineHeight: 1.2, fontStyle: "italic" }}>{a.title}</div>
                  {a.title !== a.titleFi && (
                    <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "#A09880", marginTop: 1 }}>{a.titleFi}</div>
                  )}
                  {!isUnlocked && prog.total > 1 && (
                    <div style={{ marginTop: 5, height: 2, background: "#DDD8CE", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(prog.current / prog.total) * 100}%`, background: "#3F5A45", borderRadius: 999 }}/>
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: isUnlocked ? "#C99544" : "#A09880", letterSpacing: "0.06em", flex: "0 0 auto" }}>
                  {isUnlocked ? `+${a.points}` : prog.total > 1 ? `${prog.current}/${prog.total}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
