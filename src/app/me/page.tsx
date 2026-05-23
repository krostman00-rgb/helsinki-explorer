"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

const VERSION = "v0.1";

const LANGUAGES = ["English", "Suomi", "Svenska", "Deutsch", "Français"];
const LANG_SHORT: Record<string, string> = {
  English: "En", Suomi: "Fi", Svenska: "Sv", Deutsch: "De", Français: "Fr",
};

type Theme = "light" | "dark" | "auto";

const THEME_SWATCHES: { key: Theme; label: string; bg: string; text: string }[] = [
  { key: "light", label: "Light", bg: "#FAF7F1", text: "#1A1611" },
  { key: "auto",  label: "Auto",  bg: "#3A342B", text: "#FAF7F1" },
  { key: "dark",  label: "Dark",  bg: "#0F1B2E", text: "#FAF7F1" },
];

interface MeStats {
  displayName: string | null;
  tripCount: number;
  visitCount: number;
  unlockedBadges: number;
  totalBadges: number;
  totalPoints: number;
  memberSince: string;
}

function initials(name: string | null, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function yearsMonths(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 1)  return "just arrived";
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} of Helsinki`;
  const y = Math.floor(months / 12);
  return `${y} year${y > 1 ? "s" : ""} of Helsinki`;
}

// ── Settings row ──────────────────────────────────────────────
function SettingRow({
  icon, label, value, last = false, right,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  last?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 16px", borderBottom: last ? "none" : "0.5px solid #ECE5D6" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F4EFE5", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        {icon}
      </div>
      <div style={{ flex: 1, fontFamily: "var(--font-geist-sans)", fontSize: 15, color: "#1A1611", fontWeight: 450 }}>{label}</div>
      {right ?? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {value && <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "#8C8170" }}>{value}</span>}
          <ChevronRight/>
        </div>
      )}
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="#B5A992" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 48, height: 28, borderRadius: 999,
        background: on ? "#3F5A45" : "#DDD2BC",
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 23 : 3,
        width: 22, height: 22, borderRadius: "50%", background: "#FAF7F1",
        boxShadow: "0 1px 4px rgba(26,22,17,0.18)",
        transition: "left 0.2s",
      }}/>
    </button>
  );
}

export default function MePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats]         = useState<MeStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving]       = useState(false);

  // Preferences (localStorage)
  const [lang, setLang]           = useState("English");
  const [theme, setTheme]         = useState<Theme>("auto");
  const [notifs, setNotifs]       = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    setLang(localStorage.getItem("hh_lang") ?? "English");
    setTheme((localStorage.getItem("hh_theme") as Theme) ?? "auto");
    setNotifs(localStorage.getItem("hh_notifs") !== "false");
  }, []);

  const savePref = (key: string, value: string) => localStorage.setItem(key, value);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!user) return;
    const sb = createClient();

    const [profileRes, tripsRes, visitsRes, badgesRes, totalBadgesRes] = await Promise.all([
      sb.from("profiles").select("display_name, total_points, created_at").eq("user_id", user.id).single(),
      sb.from("trips").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      sb.from("points_history").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("reason", "activity_completed"),
      sb.from("user_achievements").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      sb.from("achievements").select("id", { count: "exact", head: true }),
    ]);

    // visits: count completed activities directly
    const tripIds = (await sb.from("trips").select("id").eq("user_id", user.id)).data?.map(t => t.id) ?? [];
    let visitCount = 0;
    if (tripIds.length > 0) {
      const dayIds = (await sb.from("trip_days").select("id").in("trip_id", tripIds)).data?.map(d => d.id) ?? [];
      if (dayIds.length > 0) {
        const { count } = await sb.from("trip_activities")
          .select("id", { count: "exact", head: true })
          .in("trip_day_id", dayIds)
          .eq("completed", true);
        visitCount = count ?? 0;
      }
    }

    setStats({
      displayName: profileRes.data?.display_name ?? null,
      tripCount:    tripsRes.count ?? 0,
      visitCount,
      unlockedBadges: badgesRes.count ?? 0,
      totalBadges:    totalBadgesRes.count ?? 0,
      totalPoints:    profileRes.data?.total_points ?? 0,
      memberSince:    profileRes.data?.created_at ?? new Date().toISOString(),
    });
    setNameInput(profileRes.data?.display_name ?? "");
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) loadStats();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, loadStats]);

  const saveName = async () => {
    if (!user || !nameInput.trim()) return;
    setSaving(true);
    const sb = createClient();
    await sb.from("profiles").update({ display_name: nameInput.trim() }).eq("user_id", user.id);
    setStats(prev => prev ? { ...prev, displayName: nameInput.trim() } : prev);
    setSaving(false);
    setEditing(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/onboarding");
  };

  if (loading || authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100dvh - 68px)", background: "#F4EFE5" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "#8C8170", letterSpacing: "0.12em" }}>Loading…</div>
      </div>
    );
  }

  const name    = stats?.displayName;
  const avatarInitials = initials(name, user?.id.slice(-2).toUpperCase() ?? "EX");
  const shortId = user?.id.slice(-8).toUpperCase() ?? "--------";
  const tenure  = stats ? yearsMonths(stats.memberSince) : "exploring Helsinki";

  return (
    <div style={{ background: "#F4EFE5", minHeight: "calc(100dvh - 68px)", overflowY: "auto", paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px" }}>
        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "#8C8170", letterSpacing: "0.2em", textTransform: "uppercase" }}>Settings</span>
        <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "#8C8170", letterSpacing: "0.1em" }}>HelloHel · {VERSION}</span>
      </div>

      {/* ── Profile card ── */}
      <div style={{ margin: "0 16px 12px", background: "#1A1611", borderRadius: 20, padding: "18px 18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar */}
          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#B65A37", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
            <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 20, fontWeight: 400, color: "#FAF7F1", letterSpacing: "0.02em" }}>{avatarInitials}</span>
          </div>
          {/* Name block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                placeholder="Your name"
                style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, background: "transparent", border: "none", borderBottom: "1px solid rgba(250,247,241,0.3)", color: "#FAF7F1", outline: "none", width: "100%", padding: "2px 0" }}
              />
            ) : (
              <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, lineHeight: 1.1, color: "#FAF7F1", letterSpacing: "-0.01em", marginBottom: 3 }}>
                {name ?? `Explorer #${shortId.slice(-4)}`}
              </div>
            )}
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "rgba(250,247,241,0.4)", letterSpacing: "0.08em" }}>
              <span style={{ color: "rgba(250,247,241,0.25)" }}>@</span>
              {(name ?? `explorer${shortId.slice(-4)}`).toLowerCase().replace(/\s+/g, ".")}
              <span style={{ color: "rgba(250,247,241,0.25)" }}> · </span>
              exploring Helsinki
            </div>
          </div>
          {/* Edit / Save button */}
          {editing ? (
            <button
              onClick={saveName}
              disabled={saving}
              style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(250,247,241,0.2)", background: "rgba(250,247,241,0.12)", fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 500, color: "#FAF7F1", cursor: "pointer", flex: "0 0 auto" }}
            >
              {saving ? "…" : "Save"}
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(250,247,241,0.2)", background: "transparent", fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 500, color: "rgba(250,247,241,0.8)", cursor: "pointer", flex: "0 0 auto" }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "flex", gap: 8, margin: "0 16px 12px" }}>
        {[
          { value: String(stats?.tripCount ?? 0),         label: "trips"   },
          { value: String(stats?.visitCount ?? 0),        label: "visits"  },
          { value: `${String(stats?.unlockedBadges ?? 0).padStart(2,"0")} / ${String(stats?.totalBadges ?? 0).padStart(2,"0")}`, label: "badges" },
          { value: `${stats?.totalPoints ?? 0} pts`,      label: "earned"  },
        ].map(({ value, label }) => (
          <div key={label} style={{ flex: 1, background: "#FAF7F1", borderRadius: 14, padding: "12px 8px 10px", textAlign: "center", border: "0.5px solid #ECE5D6" }}>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 17, lineHeight: 1, letterSpacing: "-0.02em", color: "#1A1611", marginBottom: 4 }}>{value}</div>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8, color: "#8C8170", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Feature cards ── */}
      <div style={{ display: "flex", gap: 10, margin: "0 16px 12px" }}>
        {/* Trips card */}
        <div style={{ flex: 1, background: "#B65A37", borderRadius: 18, padding: "16px 16px 18px", overflow: "hidden", position: "relative", minHeight: 120 }}>
          <div style={{ position: "absolute", right: -10, bottom: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(250,247,241,0.07)" }}/>
          <div style={{ position: "absolute", right: 20, bottom: -30, width: 80, height: 80, borderRadius: "50%", background: "rgba(250,247,241,0.05)" }}/>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "rgba(250,247,241,0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Trips</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#FAF7F1", marginBottom: 8 }}>
            {stats?.tripCount ?? 0}<span style={{ fontSize: 28, opacity: 0.6 }}>.</span>
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "rgba(250,247,241,0.55)", letterSpacing: "0.06em" }}>{tenure}</div>
        </div>
        {/* Badges card */}
        <div style={{ flex: 1, background: "#3F5A45", borderRadius: 18, padding: "16px 16px 18px", overflow: "hidden", position: "relative", minHeight: 120 }}>
          <div style={{ position: "absolute", right: -10, bottom: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(250,247,241,0.06)" }}/>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "rgba(250,247,241,0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Badges</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 38, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#FAF7F1", marginBottom: 8 }}>
            {stats?.unlockedBadges ?? 0}<span style={{ fontSize: 28, opacity: 0.6 }}>.</span>
          </div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "rgba(250,247,241,0.55)", letterSpacing: "0.06em" }}>achievements unlocked</div>
        </div>
      </div>

      {/* ── Language & Theme ── */}
      <div style={{ display: "flex", gap: 10, margin: "0 16px 12px" }}>
        {/* Language */}
        <div style={{ flex: 1, background: "#FAF7F1", borderRadius: 18, padding: "16px 14px 14px", border: "0.5px solid #ECE5D6" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#8C8170", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Language</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 24, lineHeight: 1, color: "#1A1611", marginBottom: 12 }}>
            {lang}<span style={{ opacity: 0.3 }}>.</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {LANGUAGES.map(l => (
              <button
                key={l}
                onClick={() => { setLang(l); savePref("hh_lang", l); }}
                style={{ padding: "4px 10px", borderRadius: 999, border: `0.5px solid ${l === lang ? "#1A1611" : "#DDD2BC"}`, background: l === lang ? "#1A1611" : "transparent", fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: l === lang ? "#FAF7F1" : "#8C8170", cursor: "pointer", letterSpacing: "0.06em" }}
              >
                {LANG_SHORT[l]}
              </button>
            ))}
          </div>
        </div>
        {/* Theme */}
        <div style={{ flex: 1, background: "#FAF7F1", borderRadius: 18, padding: "16px 14px 14px", border: "0.5px solid #ECE5D6" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "#8C8170", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>Theme</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 24, lineHeight: 1, color: "#1A1611", marginBottom: 12 }}>
            {THEME_SWATCHES.find(t => t.key === theme)?.label ?? "Auto"}<span style={{ opacity: 0.3 }}>.</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {THEME_SWATCHES.map(t => (
              <button
                key={t.key}
                onClick={() => { setTheme(t.key); savePref("hh_theme", t.key); }}
                style={{ flex: 1, height: 28, borderRadius: 8, background: t.bg, border: t.key === theme ? "2px solid #1A1611" : "1.5px solid transparent", cursor: "pointer", transition: "border 0.15s" }}
                title={t.label}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Settings list ── */}
      <div style={{ margin: "0 16px 10px", background: "#FAF7F1", borderRadius: 18, border: "0.5px solid #ECE5D6", overflow: "hidden" }}>
        <SettingRow
          icon={<CurrencyIcon/>}
          label="Currency"
          value="EUR"
        />
        <SettingRow
          icon={<UnitsIcon/>}
          label="Units"
          value="km · °C"
        />
        <SettingRow
          icon={<BellIcon/>}
          label="Notifications"
          right={<Toggle on={notifs} onChange={v => { setNotifs(v); savePref("hh_notifs", String(v)); }}/>}
        />
        <SettingRow
          icon={<AccessibilityIcon/>}
          label="About HelloHel"
          value={VERSION}
          last
        />
      </div>

      {/* ── Sign out ── */}
      <div style={{ margin: "0 16px" }}>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ width: "100%", padding: "16px", background: "#FAF7F1", border: "0.5px solid #ECE5D6", borderRadius: 18, fontFamily: "var(--font-geist-sans)", fontSize: 15, color: signingOut ? "#8C8170" : "#C96E48", fontWeight: 500, cursor: signingOut ? "default" : "pointer", textAlign: "center" }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// ── Setting icons ─────────────────────────────────────────────
function CurrencyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8C8170" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M14.5 9a3 3 0 00-5 2.5c0 3 5 3 5 6a3 3 0 01-5 .5M12 6v2M12 16v2"/>
    </svg>
  );
}
function UnitsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8C8170" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 6h18M3 12h12M3 18h6"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8C8170" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function AccessibilityIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8C8170" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="5" r="1.5"/>
      <path d="M12 7v5M9 21l3-5 3 5M4 11h16"/>
    </svg>
  );
}
