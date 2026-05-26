"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Trash2, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult, DraggableProvidedDragHandleProps, DraggableProvidedDraggableProps } from "@hello-pangea/dnd";
import { useAuth } from "@/providers/AuthProvider";
import { useSettings } from "@/providers/SettingsProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database.types";
import { formatBudgetRange } from "@/lib/settings";

const BUDGET_MARK: Record<number, string> = { 1: "€", 2: "€€", 3: "€€€" };

const STATUS_LABEL: Record<string, string> = {
  planning:  "Planning",
  active:    "Active",
  completed: "Done",
};

const STATUS_COLOR: Record<string, string> = {
  planning:  "var(--hh-stone-400)",
  active:    "var(--hh-moss-700)",
  completed: "var(--hh-baltic-700)",
};

// ── Trip order persistence (localStorage, no DB migration needed) ────
const ORDER_KEY = "hh_trips_order";
function getStoredOrder(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]"); }
  catch { return []; }
}
function saveOrder(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
}

// ── Card visual (no Link, no swipe — pure presentational) ─────────────
function TripCardVisual({
  trip, dragHandleProps,
}: {
  trip: Trip;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
}) {
  const { currency } = useSettings();
  const budget = BUDGET_MARK[trip.budget_level] ?? "€";
  const budgetRange = currency !== "EUR" ? formatBudgetRange(trip.budget_level, currency) : null;
  const status = trip.status ?? "planning";

  return (
    <div style={{ borderRadius: 20, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", padding: "20px 20px 18px", transition: "box-shadow 0.15s", position: "relative" }}>
      {/* top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.0, letterSpacing: "-0.02em", color: "var(--hh-ink-900)", flex: 1, paddingRight: 40 }}>
          {trip.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[status] }}/>
            <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: STATUS_COLOR[status], letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {STATUS_LABEL[status]}
            </span>
          </div>
          {/* Reorder grip — only this element starts a drag */}
          <div
            data-trip-grip
            {...(dragHandleProps ?? {})}
            onClick={e => e.stopPropagation()}
            style={{ width: 24, height: 28, display: "grid", placeItems: "center", cursor: dragHandleProps ? "grab" : "default", touchAction: "none" }}
            aria-label="Reorder"
          >
            <GripVertical size={14} color="var(--hh-stone-400)" strokeWidth={1.5}/>
          </div>
        </div>
      </div>

      {/* meta row */}
      <div style={{ display: "flex", gap: 16, marginBottom: trip.interests?.length ? 14 : 0 }}>
        <div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 32, lineHeight: 0.9, letterSpacing: "-0.03em", color: "var(--hh-ink-900)" }}>{trip.duration_days}</div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.1em", marginTop: 3 }}>{trip.duration_days === 1 ? "DAY" : "DAYS"}</div>
        </div>
        <div style={{ width: "0.5px", background: "var(--hh-linen-300)", alignSelf: "stretch" }}/>
        <div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 32, lineHeight: 0.9, letterSpacing: "-0.01em", color: "var(--hh-copper-600)" }}>{budget}</div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, color: "var(--hh-stone-400)", letterSpacing: "0.1em", marginTop: 3 }}>BUDGET</div>
          {budgetRange && (
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 8.5, color: "var(--hh-stone-400)", marginTop: 2, letterSpacing: "0.04em" }}>
              ~{budgetRange}
            </div>
          )}
        </div>
        <div style={{ width: "0.5px", background: "var(--hh-linen-300)", alignSelf: "stretch" }}/>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.06em", lineHeight: 1.4 }}>
            Helsinki<br/>Finland
          </div>
        </div>
      </div>

      {/* interest tags */}
      {trip.interests?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {trip.interests.slice(0, 5).map(k => (
            <span key={k} style={{ fontFamily: "var(--font-geist-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, background: "var(--hh-linen-200)", color: "var(--hh-stone-500)", border: "0.5px solid var(--hh-linen-300)" }}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Swipeable + draggable wrapper around the card ──────────────────────
// Activation threshold: card body stays still until the user has clearly
// committed to a horizontal swipe of at least this many pixels. Below
// this it doesn't react at all to small/accidental horizontal movement.
const SWIPE_ACTIVATION = 32;
// Commit threshold: release past this distance → open delete confirm.
const SWIPE_COMMIT     = 140;

function SwipeableTripCard({
  trip,
  isPendingDelete,
  isDragging,
  draggableProps,
  dragHandleProps,
  innerRef,
  onSwipeDelete,
}: {
  trip: Trip;
  isPendingDelete: boolean;
  isDragging: boolean;
  draggableProps: DraggableProvidedDraggableProps;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  innerRef: (el: HTMLElement | null) => void;
  onSwipeDelete: (trip: Trip) => void;
}) {
  const router = useRouter();
  const [dx, setDx] = useState(0);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const axisRef   = useRef<"x" | "y" | null>(null);
  const swipedRef = useRef(false);

  const reset = () => {
    setDx(0);
    startXRef.current = null;
    startYRef.current = null;
    axisRef.current   = null;
    // swipedRef stays true until next onClick clears it
  };

  // When parent clears its pending-delete state (i.e. user pressed Cancel
  // in the confirm sheet), spring the card back to its rest position.
  useEffect(() => {
    if (!isPendingDelete) {
      setDx(0);
      axisRef.current = null;
      swipedRef.current = false;
    }
  }, [isPendingDelete]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isDragging || isPendingDelete) return;
    // ignore swipes that begin on the reorder grip
    if ((e.target as HTMLElement).closest("[data-trip-grip]")) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    axisRef.current   = null;
    swipedRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;
    const dxRaw = e.clientX - startXRef.current;
    const dyRaw = e.clientY - startYRef.current;

    // Only lock onto the swipe axis when horizontal movement is BOTH
    // large enough AND clearly dominant over vertical — otherwise let
    // it be a vertical scroll / tap.
    if (!axisRef.current) {
      if (dxRaw > SWIPE_ACTIVATION && dxRaw > Math.abs(dyRaw) * 1.4) {
        axisRef.current = "x";
      } else if (Math.abs(dyRaw) > 12 || dxRaw < 0) {
        axisRef.current = "y"; // give up — not a delete swipe
      }
    }

    if (axisRef.current === "x") {
      // Subtract activation distance so the card doesn't pop from 0 → 32
      const visible = Math.max(0, Math.min(dxRaw - SWIPE_ACTIVATION, 320));
      setDx(visible);
      if (visible > 0) swipedRef.current = true;
    }
  };

  const onPointerUp = () => {
    if (axisRef.current === "x" && dx > SWIPE_COMMIT) {
      // Animate off-screen, then notify parent. Parent opens confirm sheet
      // and sets isPendingDelete=true for this card, which holds dx high
      // until the user either confirms (unmount) or cancels (spring back).
      setDx(480);
      setTimeout(() => onSwipeDelete(trip), 220);
      return;
    }
    reset();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
      return;
    }
    router.push(`/trips/${trip.id}`);
  };

  const swipeProgress = Math.min(dx / SWIPE_COMMIT, 1);
  const willDelete    = dx > SWIPE_COMMIT;

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      style={{
        ...draggableProps.style,
        position: "relative",
        marginBottom: 10,
        touchAction: "pan-y",
      }}
    >
      {/* Red delete backing — fades in with swipe progress */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 20,
        background: willDelete ? "#C0392B" : "rgba(192,57,43,0.78)",
        display: "flex", alignItems: "center", gap: 10, paddingLeft: 24,
        opacity: swipeProgress,
        transition: "background 0.15s, opacity 0.2s",
        pointerEvents: "none",
      }}>
        <Trash2 size={20} color="#FAF7F1" strokeWidth={1.6}/>
        <span style={{ color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 14, fontWeight: 500 }}>
          {willDelete ? "Release to delete" : "Keep swiping…"}
        </span>
      </div>

      {/* Card itself — translates horizontally on swipe */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onClick={handleClick}
        style={{
          transform: `translateX(${dx}px)`,
          transition:
            dx === 0 || dx >= 320 || isPendingDelete === false
              ? "transform 0.28s cubic-bezier(0.32,0.72,0,1)"
              : "none",
          cursor: "pointer",
        }}
      >
        <TripCardVisual trip={trip} dragHandleProps={dragHandleProps}/>
      </div>
    </div>
  );
}

// ── Delete confirmation sheet ─────────────────────────────────────────
function DeleteConfirm({ trip, onConfirm, onCancel }: { trip: Trip; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.45)", zIndex: 40, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}/>
      <div className="hh-sheet-enter" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--hh-linen-50)", borderRadius: "24px 24px 0 0", padding: "20px 24px 44px", boxShadow: "0 -8px 40px rgba(10,15,25,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--hh-linen-300)" }}/>
        </div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.1, color: "var(--hh-ink-900)", marginBottom: 6 }}>
          Delete &ldquo;{trip.title}&rdquo;?
        </div>
        <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-stone-500)", lineHeight: 1.5, marginBottom: 24 }}>
          This will permanently remove the trip and all its activities. This cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 52, borderRadius: 24, border: "0.5px solid var(--hh-linen-300)", background: "transparent", fontFamily: "var(--font-geist-sans)", fontSize: 15, color: "var(--hh-ink-900)", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex: 1, height: 52, borderRadius: 24, border: "none", background: "#C0392B", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    </>
  );
}

export default function TripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [trips, setTrips]               = useState<Trip[]>([]);
  const [isLoading, setLoading]         = useState(true);
  const [confirmTrip, setConfirmTrip]   = useState<Trip | null>(null);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setLoading(false);
      return;
    }
    createClient()
      .from("trips")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const all = data ?? [];
        // Apply persisted order: known IDs first in saved order, new ones at the top
        const order = getStoredOrder();
        const ordered = order
          .map(id => all.find(t => t.id === id))
          .filter((t): t is Trip => !!t);
        const newOnes = all.filter(t => !order.includes(t.id));
        setTrips([...newOnes, ...ordered]);
        setLoading(false);
      });
  }, [user, authLoading]);

  // Persist order whenever trips list changes (skip initial load)
  const trippedRef = useRef(false);
  useEffect(() => {
    if (!trippedRef.current) { if (trips.length > 0) trippedRef.current = true; return; }
    saveOrder(trips.map(t => t.id));
  }, [trips]);

  const deleteTrip = async (trip: Trip) => {
    setConfirmTrip(null);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
    await createClient().from("trips").delete().eq("id", trip.id);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    setTrips(prev => {
      const next = [...prev];
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination!.index, 0, moved);
      return next;
    });
  };

  const showLoading = authLoading || isLoading;

  // Trip list body — re-renders when confirmTrip changes so cards know
  // whether they're currently in the confirm-sheet state (and spring
  // back if it clears).
  const pendingId = confirmTrip?.id ?? null;
  const listBody = useMemo(() => {
    if (trips.length === 0) return null;
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="trips">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {trips.map((trip, i) => (
                <Draggable key={trip.id} draggableId={trip.id} index={i}>
                  {(prov, snapshot) => (
                    <SwipeableTripCard
                      trip={trip}
                      isPendingDelete={pendingId === trip.id}
                      isDragging={snapshot.isDragging}
                      draggableProps={prov.draggableProps}
                      dragHandleProps={prov.dragHandleProps}
                      innerRef={prov.innerRef}
                      onSwipeDelete={setConfirmTrip}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    );
  }, [trips, pendingId]);

  return (
    <div className="hh-page-enter" style={{ background: "var(--hh-linen-100)", minHeight: "calc(100dvh - 68px)", padding: "48px 20px 40px" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: "var(--hh-stone-400)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>Your trips</div>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 36, lineHeight: 0.9, letterSpacing: "-0.02em", color: "var(--hh-ink-900)" }}>
            Helsinki.
          </div>
        </div>
        <Link
          href="/onboarding"
          style={{ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", borderRadius: 999, background: "var(--hh-ink-900)", color: "var(--hh-linen-50)", fontFamily: "var(--font-geist-sans)", fontSize: 13, fontWeight: 500, textDecoration: "none" }}
        >
          <Plus size={14} strokeWidth={2}/>
          New trip
        </Link>
      </div>

      {showLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ height: 168, borderRadius: 20, background: "rgba(180,165,145,0.18)", animation: "hh-skeleton-pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}/>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, color: "var(--hh-linen-300)", letterSpacing: "-0.02em" }}>No trips yet.</div>
          <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-stone-400)", lineHeight: 1.5 }}>Plan your first Helsinki adventure.</div>
          <Link href="/onboarding" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 24px", borderRadius: 999, background: "var(--hh-copper-600)", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, textDecoration: "none", boxShadow: "0 6px 20px rgba(182,90,55,0.35)" }}>
            Start planning
            <ArrowRight size={16} strokeWidth={1.8}/>
          </Link>
        </div>
      ) : (
        listBody
      )}

      {confirmTrip && (
        <DeleteConfirm
          trip={confirmTrip}
          onConfirm={() => deleteTrip(confirmTrip)}
          onCancel={() => setConfirmTrip(null)}
        />
      )}
    </div>
  );
}
