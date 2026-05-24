"use client";

import { Footprints } from "lucide-react";
import { getModeColor, getModeLabel, type TransitResult, type TransitLeg } from "@/lib/transit";

// ── Inline SVG icons (small, sharp) ───────────────────────────
const TramIcon   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="6" y="3" width="12" height="14" rx="2" fill="white"/><circle cx="9" cy="20" r="1.5" fill="white"/><circle cx="15" cy="20" r="1.5" fill="white"/></svg>;
const MetroIcon  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 4l7 8 7-8M5 20l7-8 7 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const BusIcon    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="12" rx="2" fill="white"/><circle cx="8" cy="20" r="1.5" fill="white"/><circle cx="16" cy="20" r="1.5" fill="white"/></svg>;
const RailIcon   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="14" rx="3" fill="white"/><path d="M5 11h14" stroke="currentColor" strokeWidth="1.2"/></svg>;
const FerryIcon  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M3 15l1.5-4h15L21 15M5 11V7h6V5h2v2h6v4" stroke="white" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>;

function ModeGlyph({ mode }: { mode: string }) {
  switch (mode) {
    case "TRAM":   return <TramIcon/>;
    case "SUBWAY": return <MetroIcon/>;
    case "BUS":    return <BusIcon/>;
    case "RAIL":   return <RailIcon/>;
    case "FERRY":  return <FerryIcon/>;
    default:       return null;
  }
}

// ── A single leg row ──────────────────────────────────────────
function LegRow({ leg }: { leg: TransitLeg }) {
  if (leg.mode === "WALK") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "var(--hh-linen-200)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
          <Footprints size={11} color="var(--hh-stone-500)" strokeWidth={1.8}/>
        </div>
        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "var(--hh-stone-500)", fontWeight: 500 }}>
          {leg.durationMin} min · {Math.round(leg.distanceM)} m
        </span>
      </div>
    );
  }

  const color = getModeColor(leg);
  const label = getModeLabel(leg);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "2px 0" }}>
      {/* Colored mode badge with line number */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, background: color, color: "#FFF", borderRadius: 4, padding: "1px 4px", height: 18, flex: "0 0 auto", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" }}>
        <ModeGlyph mode={leg.mode}/>
        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1 }}>
          {label}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, color: "var(--hh-ink-900)", fontWeight: 500, lineHeight: 1.2 }}>
          {leg.durationMin} min
        </span>
        {leg.headsign && (
          <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 9.5, color: "var(--hh-stone-500)", lineHeight: 1.3, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={`→ ${leg.headsign}`}>
            → {leg.headsign}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main connector ────────────────────────────────────────────
export function TransitConnector({ transit, loading }: { transit: TransitResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", width: 56 }}>
        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(26,22,17,0.2)", animation: "pulse 1.2s ease infinite" }}/>
      </div>
    );
  }
  if (!transit) return <div style={{ flex: "0 0 8px" }}/>;

  return (
    <div style={{
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      gap: 2,
      padding: "10px 10px",
      minWidth: 150,
      maxWidth: 170,
      background: "var(--hh-linen-50)",
      border: "0.5px solid var(--hh-linen-300)",
      borderRadius: 12,
      margin: "0 6px",
    }}>
      {/* Total time */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 600, color: "var(--hh-ink-900)" }}>
          {transit.totalMin} min
        </span>
        {transit.walkDistanceM > 0 && (
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9, color: "var(--hh-stone-400)", letterSpacing: "0.04em" }}>
            {Math.round(transit.walkDistanceM)} m
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--hh-linen-300)", margin: "2px -2px 4px" }}/>

      {/* Legs */}
      {transit.legs.map((leg, i) => <LegRow key={i} leg={leg}/>)}
    </div>
  );
}
