"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

interface ProfileStats {
  totalPoints: number;
  level: number;
  tripCount: number;
}

const ACHIEVEMENTS = [
  { key: "first_trip",   icon: "🗺",  title: "Helsinki Rookie",    points: 50  },
  { key: "cafe_5",       icon: "☕", title: "Aamukahvi",           points: 100 },
  { key: "sauna_3",      icon: "♨",  title: "Saunamestari",        points: 150 },
  { key: "suomenlinna",  icon: "⛵",  title: "Saaristoseilari",     points: 75  },
  { key: "design_5",     icon: "◎",  title: "Designsisäänpiiri",   points: 100 },
  { key: "food_3",       icon: "🐟", title: "Kalakukko",           points: 100 },
  { key: "all_complete", icon: "❤",  title: "Helsinki sydämessä",  points: 200 },
];

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({ totalPoints: 0, level: 1, tripCount: 0 });

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    Promise.all([
      supabase.from("profiles").select("total_points, level").eq("user_id", user.id).single(),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([profileRes, tripsRes]) => {
      setStats({
        totalPoints: profileRes.data?.total_points ?? 0,
        level:       profileRes.data?.level ?? 1,
        tripCount:   tripsRes.count ?? 0,
      });
    });
  }, [user]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", background: "var(--hh-linen-100)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading…</div>
      </div>
    );
  }

  const shortId = user?.id.slice(0, 8).toUpperCase() ?? "--------";

  return (
    <div style={{ background: "var(--hh-linen-100)", minHeight: "calc(100dvh - 68px)", padding: "48px 20px 40px" }}>

      {/* Passport card */}
      <div style={{ borderRadius: 20, background: "var(--hh-ink-900)", padding: "24px 22px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        {/* grain overlay */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(rgba(250,247,241,0.8) 1px, transparent 1px)", backgroundSize: "3px 3px", pointerEvents: "none" }}/>

        {/* top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-geist-sans)", fontSize: 12, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--hh-linen-50)" }}>
            <svg width="12" height="12" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6.25" fill="none" stroke="var(--hh-linen-50)" strokeWidth="1.25"/><circle cx="7" cy="7" r="2" fill="var(--hh-linen-50)"/></svg>
            hello<span style={{ opacity: 0.45 }}>·</span>hel
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(250,247,241,0.4)", letterSpacing: "0.1em" }}>EXPLORER PASS</div>
        </div>

        {/* Big number */}
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 72, lineHeight: 0.82, letterSpacing: "-0.04em", color: "var(--hh-linen-50)", marginBottom: 6, position: "relative" }}>
          {stats.level}
        </div>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "rgba(250,247,241,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 24, position: "relative" }}>
          Level · {stats.totalPoints} pts
        </div>

        {/* Divider */}
        <div style={{ borderTop: "0.5px solid rgba(250,247,241,0.12)", marginBottom: 18 }}/>

        {/* Card footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative" }}>
          <div>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(250,247,241,0.35)", letterSpacing: "0.14em", marginBottom: 3 }}>PASS ID</div>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, color: "rgba(250,247,241,0.7)", letterSpacing: "0.08em" }}>{shortId}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "rgba(250,247,241,0.35)", letterSpacing: "0.14em", marginBottom: 3 }}>TRIPS</div>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, lineHeight: 0.9, color: "var(--hh-copper-600)" }}>{stats.tripCount}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
        <div style={{ padding: "16px 18px", borderRadius: 16, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Points</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--hh-ink-900)" }}>{stats.totalPoints}</div>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 16, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-500)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Trips</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--hh-ink-900)" }}>{stats.tripCount}</div>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Achievements</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ACHIEVEMENTS.map(a => (
            <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 14, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", opacity: 0.5 }}>
              <span style={{ fontSize: 20, flex: "0 0 auto" }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500, color: "var(--hh-ink-900)", lineHeight: 1.2 }}>{a.title}</div>
              </div>
              <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "var(--hh-stone-400)", letterSpacing: "0.06em" }}>+{a.points}</div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, textAlign: "center", fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.1em" }}>
          Complete activities to unlock
        </p>
      </div>
    </div>
  );
}
