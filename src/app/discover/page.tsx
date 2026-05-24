"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Check, MapPin, Star } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Place } from "@/types/database.types";

// ── Deterministic image per place ─────────────────────────────
function imageUrl(place: Place): string {
  const seed = place.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `https://picsum.photos/seed/${seed}/420/540`;
}

const CAT_COLOR: Record<string, string> = {
  food:"#B65A37", cafe:"#B65A37", shop:"#B65A37",
  sauna:"#3F5A45", nature:"#3F5A45", family:"#3F5A45",
  museums:"#133A5B", history:"#133A5B", arch:"#133A5B",
  design:"#1A1611", night:"#C99544", events:"#C99544",
};

const CAT_LABEL: Record<string, string> = {
  food:"Restaurant", cafe:"Café", sauna:"Sauna", museums:"Museum",
  history:"Historic", nature:"Nature", arch:"Architecture",
  design:"Design", shop:"Shopping", night:"Nightlife",
};

const PRICE: Record<number, string> = { 1:"€", 2:"€€", 3:"€€€" };

// ── Swipe threshold ───────────────────────────────────────────
const THRESHOLD = 110;

// ── Card component ────────────────────────────────────────────
interface CardProps {
  place: Place;
  stackPos: 0 | 1 | 2;
  progressRatio: number;
  onSwipe: (dir: "left" | "right") => void;
  onDragProgress?: (ratio: number) => void;
  commandedExit?: "left" | "right" | null;  // parent triggers button-tap animation
}

function PlaceCard({ place, stackPos, progressRatio, onSwipe, onDragProgress, commandedExit }: CardProps) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [phase, setPhase] = useState<"idle" | "dragging" | "flying-right" | "flying-left">("idle");
  const startRef = useRef({ x: 0, y: 0 });
  const cardRef  = useRef<HTMLDivElement>(null);

  const isTop = stackPos === 0;

  const exitDir = useCallback((dir: "left" | "right") => {
    const target = dir === "right" ? 620 : -620;
    setDrag({ x: target, y: 0 });
    setPhase(dir === "right" ? "flying-right" : "flying-left");
    onDragProgress?.(0);
    setTimeout(() => onSwipe(dir), 380);
  }, [onSwipe, onDragProgress]);

  // Respond to button-triggered exit command
  useEffect(() => {
    if (commandedExit && isTop && phase === "idle") {
      exitDir(commandedExit);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandedExit]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isTop || phase !== "idle") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setPhase("dragging");
  }, [isTop, phase]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (phase !== "dragging") return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setDrag({ x: dx, y: dy });
    onDragProgress?.(Math.min(1, Math.abs(dx) / THRESHOLD));
  }, [phase, onDragProgress]);

  const onPointerUp = useCallback(() => {
    if (phase !== "dragging") return;
    if (drag.x > THRESHOLD)       exitDir("right");
    else if (drag.x < -THRESHOLD) exitDir("left");
    else {
      setDrag({ x: 0, y: 0 });
      setPhase("idle");
      onDragProgress?.(0);
    }
  }, [phase, drag.x, exitDir, onDragProgress]);

  // Stack visual transforms
  const isFlying = phase === "flying-right" || phase === "flying-left";
  const rotation = isTop ? drag.x * 0.065 : 0;

  let scale  = 1;
  let yShift = 0;
  if (stackPos === 1) { scale = 0.94 + progressRatio * 0.06; yShift = 18 - progressRatio * 18; }
  if (stackPos === 2) { scale = 0.88 + progressRatio * 0.06; yShift = 36 - progressRatio * 18; }

  const transform = isTop
    ? `translateX(${drag.x}px) translateY(${drag.y * 0.25}px) rotate(${rotation}deg)`
    : `translateY(${yShift}px) scale(${scale})`;

  const transition = phase === "dragging" ? "none"
    : isFlying ? "transform 0.38s cubic-bezier(0.55, 0, 1, 0.45)"
    : "transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1)";

  // Like / Nope overlays
  const showLike  = isTop && drag.x > 40;
  const showNope  = isTop && drag.x < -40;
  const likeOpacity = Math.min(1, (drag.x - 40) / 60);
  const nopeOpacity = Math.min(1, (-drag.x - 40) / 60);

  return (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute", inset: 0,
        transform, transition,
        borderRadius: 24,
        overflow: "hidden",
        background: "#FAF7F1",
        boxShadow: stackPos === 0
          ? "0 8px 40px rgba(26,22,17,0.22)"
          : "0 4px 20px rgba(26,22,17,0.12)",
        userSelect: "none",
        touchAction: "none",
        cursor: isTop ? (phase === "dragging" ? "grabbing" : "grab") : "default",
        willChange: "transform",
        zIndex: 3 - stackPos,
      }}
    >
      {/* ── Image ── */}
      <div style={{ position: "relative", height: "58%", overflow: "hidden", background: CAT_COLOR[place.category] ?? "#B5A992" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(place)}
          alt={place.name}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {/* gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(26,22,17,0.45) 100%)" }}/>

        {/* LIKE stamp */}
        {showLike && (
          <div style={{ position: "absolute", top: 32, left: 24, border: "3px solid #3F5A45", borderRadius: 10, padding: "4px 14px", transform: "rotate(-18deg)", opacity: likeOpacity, transition: "opacity 0.08s" }}>
            <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, color: "#3F5A45", letterSpacing: "0.04em" }}>ADD</span>
          </div>
        )}
        {/* NOPE stamp */}
        {showNope && (
          <div style={{ position: "absolute", top: 32, right: 24, border: "3px solid #C96E48", borderRadius: 10, padding: "4px 14px", transform: "rotate(18deg)", opacity: nopeOpacity, transition: "opacity 0.08s" }}>
            <span style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, color: "#C96E48", letterSpacing: "0.04em" }}>SKIP</span>
          </div>
        )}

        {/* Category pill */}
        <div style={{ position: "absolute", bottom: 12, left: 14, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(26,22,17,0.55)", backdropFilter: "blur(6px)", borderRadius: 999, padding: "4px 10px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: CAT_COLOR[place.category] ?? "#B5A992", flex: "0 0 auto" }}/>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "#FAF7F1", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {CAT_LABEL[place.category] ?? place.category}
          </span>
        </div>
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "16px 18px 20px" }}>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.1, color: "#1A1611", letterSpacing: "-0.01em", marginBottom: 6 }}>
          {place.name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {place.rating && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={11} color="#C99544" fill="#C99544" strokeWidth={0}/>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "#8C8170" }}>{place.rating}</span>
            </div>
          )}
          {place.price_level && (
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "#8C8170" }}>{PRICE[place.price_level]}</span>
          )}
        </div>

        {place.description && (
          <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 13, lineHeight: 1.55, color: "#3A342B", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {place.description}
          </div>
        )}

        {place.address && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={10} color="#B5A992" strokeWidth={1.5}/>
            <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11.5, color: "#8C8170" }}>{place.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DiscoverPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [places, setPlaces]         = useState<Place[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tripDayId, setTripDayId]   = useState<string | null>(null);
  const [addedCount, setAddedCount]     = useState(0);
  const [toast, setToast]               = useState<string | null>(null);
  const [dragRatio, setDragRatio]       = useState(0);
  const [commandedExit, setCommandedExit] = useState<"left" | "right" | null>(null);

  // Reset command when card advances
  useEffect(() => { setCommandedExit(null); }, [currentIdx]);

  const handleDragProgress = useCallback((ratio: number) => {
    setDragRatio(ratio);
  }, []);

  // Load places (exclude already-in-trip ones)
  useEffect(() => {
    if (!user) return;
    const sb = createClient();
    (async () => {
      const { data: trips } = await sb
        .from("trips").select("id").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1);
      const tripId = trips?.[0]?.id ?? null;

      // Get first day
      let dayId: string | null = null;
      if (tripId) {
        const { data: days } = await sb
          .from("trip_days").select("id").eq("trip_id", tripId)
          .order("day_number").limit(1);
        dayId = days?.[0]?.id ?? null;
      }
      setTripDayId(dayId);

      // Get place IDs already in trip
      let existingPlaceIds: string[] = [];
      if (tripId) {
        const { data: dayRows } = await sb.from("trip_days").select("id").eq("trip_id", tripId);
        const allDayIds = dayRows?.map(d => d.id) ?? [];
        if (allDayIds.length > 0) {
          const { data: acts } = await sb
            .from("trip_activities").select("place_id").in("trip_day_id", allDayIds);
          existingPlaceIds = acts?.map(a => a.place_id).filter(Boolean) as string[] ?? [];
        }
      }

      // All places not already in trip
      const { data: allPlaces } = await sb.from("places").select("*");
      const remaining = (allPlaces ?? []).filter(p => !existingPlaceIds.includes(p.id));
      // Shuffle
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      setPlaces(remaining);
      setLoading(false);
    })();
  }, [user]);

  // Preload next card's image
  useEffect(() => {
    if (currentIdx + 1 < places.length) {
      const img = new window.Image();
      img.src = imageUrl(places[currentIdx + 1]);
    }
    if (currentIdx + 2 < places.length) {
      const img = new window.Image();
      img.src = imageUrl(places[currentIdx + 2]);
    }
  }, [currentIdx, places]);

  const addToTrip = useCallback(async (place: Place) => {
    if (!tripDayId || !user) return;
    const sb = createClient();
    const { count } = await sb
      .from("trip_activities")
      .select("id", { count: "exact", head: true })
      .eq("trip_day_id", tripDayId);
    await sb.from("trip_activities").insert({
      trip_day_id:  tripDayId,
      place_id:     place.id,
      title:        place.name,
      order_index:  (count ?? 0) + 1,
    });
  }, [tripDayId, user]);

  const handleSwipe = useCallback(async (dir: "left" | "right") => {
    setDragRatio(0);
    if (dir === "right") {
      const place = places[currentIdx];
      await addToTrip(place);
      setAddedCount(n => n + 1);
      setToast(`Added ${place.name}`);
      setTimeout(() => setToast(null), 2000);
    }
    setCurrentIdx(n => n + 1);
  }, [places, currentIdx, addToTrip]);

  // Button tap: set the command — card's useEffect picks it up and runs exitDir,
  // which fires onSwipe (handleSwipe) after the animation completes.
  const triggerSwipe = useCallback((dir: "left" | "right") => {
    setCommandedExit(dir);
  }, []);

  if (authLoading || loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#F0EDE6" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, color: "#8C8170", letterSpacing: "0.12em" }}>Loading places…</div>
      </div>
    );
  }

  // Guard: no trip exists yet
  if (!tripDayId) {
    return (
      <div style={{ height: "100dvh", background: "#F0EDE6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 32px", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🗺️</div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, color: "#1A1611" }}>No trip yet</div>
        <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "#8C8170", lineHeight: 1.6 }}>
          Create a Helsinki trip first — then come back here to discover more places.
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          style={{ marginTop: 8, height: 48, padding: "0 28px", borderRadius: 999, background: "#1A1611", border: "none", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, color: "#FAF7F1", cursor: "pointer" }}
        >
          Create trip →
        </button>
        <button
          onClick={() => router.back()}
          style={{ height: 36, padding: "0 20px", borderRadius: 999, background: "transparent", border: "0.5px solid #DDD8CE", fontFamily: "var(--font-geist-sans)", fontSize: 13, color: "#8C8170", cursor: "pointer" }}
        >
          Go back
        </button>
      </div>
    );
  }

  const remaining = places.length - currentIdx;
  const done = remaining <= 0;

  return (
    <div style={{ height: "100dvh", background: "#F0EDE6", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 20px 12px", flex: "0 0 auto" }}>
        <button
          onClick={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: 999, background: "#FAF7F1", border: "0.5px solid #DDD8CE", display: "grid", placeItems: "center", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="#1A1611" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 22, color: "#1A1611", textAlign: "center", lineHeight: 1 }}>Discover</div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "#8C8170", letterSpacing: "0.12em", textAlign: "center", marginTop: 2 }}>{remaining} places left</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: "#FAF7F1", border: "0.5px solid #DDD8CE", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11, fontWeight: 700, color: "#3F5A45" }}>+{addedCount}</span>
        </div>
      </div>

      {/* ── Card stack ── */}
      <div style={{ flex: 1, position: "relative", margin: "0 20px" }}>
        {done ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, color: "#1A1611" }}>All done!</div>
            <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "#8C8170", textAlign: "center" }}>
              {addedCount > 0 ? `Added ${addedCount} place${addedCount > 1 ? "s" : ""} to your trip.` : "No new places added."}
            </div>
            <button
              onClick={() => router.push("/map")}
              style={{ marginTop: 8, height: 48, padding: "0 28px", borderRadius: 999, background: "#1A1611", border: "none", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, color: "#FAF7F1", cursor: "pointer" }}
            >
              Back to map →
            </button>
          </div>
        ) : (
          <>
            {/* Render top 3 cards in reverse order (z-index handles stacking) */}
            {[2, 1, 0].map(offset => {
              const idx = currentIdx + offset;
              if (idx >= places.length) return null;
              return (
                <PlaceCard
                  key={places[idx].id}
                  place={places[idx]}
                  stackPos={offset as 0 | 1 | 2}
                  progressRatio={dragRatio}
                  onSwipe={handleSwipe}
                  onDragProgress={offset === 0 ? handleDragProgress : undefined}
                  commandedExit={offset === 0 ? commandedExit : null}
                />
              );
            })}
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      {!done && (
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "16px 20px 28px" }}>
          {/* Skip */}
          <button
            onClick={() => triggerSwipe("left")}
            style={{ width: 60, height: 60, borderRadius: "50%", background: "#FAF7F1", border: "1px solid #DDD8CE", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 2px 12px rgba(26,22,17,0.10)" }}
          >
            <X size={22} color="#C96E48" strokeWidth={2}/>
          </button>
          {/* Add */}
          <button
            onClick={() => triggerSwipe("right")}
            style={{ width: 72, height: 72, borderRadius: "50%", background: "#3F5A45", border: "none", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 20px rgba(63,90,69,0.35)" }}
          >
            <Check size={26} color="#FAF7F1" strokeWidth={2.5}/>
          </button>
          {/* Skip text */}
          <button
            onClick={() => router.push("/map")}
            style={{ width: 60, height: 60, borderRadius: "50%", background: "transparent", border: "1px solid #DDD8CE", display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M11 5l5 5-5 5" stroke="#8C8170" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 100, whiteSpace: "nowrap", background: "#3F5A45", color: "#FAF7F1", fontFamily: "var(--font-geist-mono)", fontSize: 11, letterSpacing: "0.08em", padding: "9px 18px", borderRadius: 999, boxShadow: "0 4px 20px rgba(26,22,17,0.2)", pointerEvents: "none" }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
