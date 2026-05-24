// ── HSL transit helpers ───────────────────────────────────────
// Mode colors per HSL brand guidelines.

export interface TransitLeg {
  mode: "WALK" | "BUS" | "TRAM" | "SUBWAY" | "RAIL" | "FERRY";
  durationMin: number;
  distanceM: number;
  line: string | null;
  routeName: string | null;
  routeType: number | null;
  headsign: string | null;
  fromStop: string | null;
  toStop: string | null;
}

export interface TransitResult {
  totalMin: number;
  walkDistanceM: number;
  legs: TransitLeg[];
}

// ── Colors (from spec) ────────────────────────────────────────
export const MODE_COLOR = {
  busRegular: "#005597", // Sininen   — peruslinjat
  busTrunk:   "#e23b12", // Oranssi   — runkolinjat
  metro:      "#e23b12", // Oranssi   — metro
  tram:       "#009e59", // Vihreä    — raitiovaunut
  rail:       "#7b2cbf", // Violetti  — lähijunat
  lightRail:  "#00a8a8", // Turkoosi  — pikaraitiotie (Raide-Jokeri)
  ferry:      "#1f6b8a", // Tummansin — lautat
  walk:       "#8C8170", // Stone     — kävely
} as const;

// ── HSL trunk bus lines (Runkolinjat) ─────────────────────────
// Active trunk lines as of 2024 — they run with metro/tram-like frequency.
const TRUNK_BUS_LINES = new Set([
  "200", "500", "510", "520", "530", "540", "550", "560", "570",
  "210", "211",
]);

function isTrunkBus(line: string | null): boolean {
  if (!line) return false;
  return TRUNK_BUS_LINES.has(line);
}

// Tram line 15 = Raide-Jokeri (Pikaraitiotie / Light rail)
function isLightRail(mode: string, line: string | null, routeType: number | null): boolean {
  if (mode === "TRAM" && line === "15") return true;
  // GTFS extended route_type 109 or 900 = Light rail
  if (routeType === 109 || routeType === 900) return true;
  return false;
}

export function getModeColor(leg: { mode: string; line: string | null; routeType: number | null }): string {
  const { mode, line, routeType } = leg;
  if (isLightRail(mode, line, routeType)) return MODE_COLOR.lightRail;
  switch (mode) {
    case "TRAM":   return MODE_COLOR.tram;
    case "SUBWAY": return MODE_COLOR.metro;
    case "RAIL":   return MODE_COLOR.rail;
    case "FERRY":  return MODE_COLOR.ferry;
    case "BUS":    return isTrunkBus(line) ? MODE_COLOR.busTrunk : MODE_COLOR.busRegular;
    default:       return MODE_COLOR.walk;
  }
}

// ── Mode short label (used on the colored badge) ──────────────
export function getModeLabel(leg: { mode: string; line: string | null }): string {
  if (leg.line) return leg.line;       // "M1", "9", "550", "A"
  switch (leg.mode) {
    case "TRAM":   return "T";
    case "SUBWAY": return "M";
    case "RAIL":   return "R";
    case "BUS":    return "B";
    case "FERRY":  return "⛴";
    default:       return "·";
  }
}

// ── Finnish mode name ────────────────────────────────────────
export function getModeName(mode: string): string {
  switch (mode) {
    case "TRAM":   return "Raitio";
    case "SUBWAY": return "Metro";
    case "BUS":    return "Bussi";
    case "RAIL":   return "Juna";
    case "FERRY":  return "Lautta";
    case "WALK":   return "Kävely";
    default:       return mode;
  }
}
