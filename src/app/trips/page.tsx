"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database.types";

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

function DeleteConfirm({ trip, onConfirm, onCancel }: { trip: Trip; onConfirm: () => void; onCancel: () => void }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(10,15,25,0.45)", zIndex: 40, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}/>
      <div className="hh-sheet-enter" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--hh-linen-50)", borderRadius: "24px 24px 0 0", padding: "20px 24px 44px", boxShadow: "0 -8px 40px rgba(10,15,25,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--hh-linen-300)" }}/>
        </div>
        <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.1, color: "var(--hh-ink-900)", marginBottom: 6 }}>
          Delete "{trip.title}"?
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

function TripCard({ trip, onDeleteRequest }: { trip: Trip; onDeleteRequest: (t: Trip) => void }) {
  const budget = BUDGET_MARK[trip.budget_level] ?? "€";
  const status = trip.status ?? "planning";

  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <Link href={`/trips/${trip.id}`} style={{ display: "block", textDecoration: "none" }}>
        <div style={{ borderRadius: 20, background: "var(--hh-linen-50)", border: "0.5px solid var(--hh-linen-300)", padding: "20px 20px 18px", transition: "box-shadow 0.15s" }}>
          {/* top row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 26, lineHeight: 1.0, letterSpacing: "-0.02em", color: "var(--hh-ink-900)", flex: 1, paddingRight: 40 }}>
              {trip.title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flex: "0 0 auto" }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[status] }}/>
              <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10, color: STATUS_COLOR[status], letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {STATUS_LABEL[status]}
              </span>
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
      </Link>

      {/* Delete button — outside Link so it doesn't trigger navigation */}
      <button
        onClick={e => { e.stopPropagation(); onDeleteRequest(trip); }}
        style={{ position: "absolute", top: 14, right: 14, zIndex: 2, width: 32, height: 32, borderRadius: 10, border: "0.5px solid var(--hh-linen-300)", background: "var(--hh-linen-100)", display: "grid", placeItems: "center", cursor: "pointer" }}
      >
        <Trash2 size={13} color="var(--hh-stone-400)" strokeWidth={1.5}/>
      </button>
    </div>
  );
}

export default function TripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [trips, setTrips]           = useState<Trip[]>([]);
  const [isLoading, setLoading]     = useState(true);
  const [confirmTrip, setConfirmTrip] = useState<Trip | null>(null);

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
        setTrips(data ?? []);
        setLoading(false);
      });
  }, [user, authLoading]);

  const deleteTrip = async (trip: Trip) => {
    setConfirmTrip(null);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
    await createClient().from("trips").delete().eq("id", trip.id);
  };

  if (authLoading || isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100dvh - 68px)", background: "var(--hh-linen-100)" }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12, color: "var(--hh-stone-500)", letterSpacing: "0.1em" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--hh-linen-100)", minHeight: "calc(100dvh - 68px)", padding: "48px 20px 40px" }}>
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

      {trips.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 16, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", fontSize: 28, color: "var(--hh-linen-300)", letterSpacing: "-0.02em" }}>No trips yet.</div>
          <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 14, color: "var(--hh-stone-400)", lineHeight: 1.5 }}>Plan your first Helsinki adventure.</div>
          <Link href="/onboarding" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 24px", borderRadius: 999, background: "var(--hh-copper-600)", color: "#FAF7F1", fontFamily: "var(--font-geist-sans)", fontSize: 15, fontWeight: 500, textDecoration: "none", boxShadow: "0 6px 20px rgba(182,90,55,0.35)" }}>
            Start planning
            <ArrowRight size={16} strokeWidth={1.8}/>
          </Link>
        </div>
      ) : (
        <div>
          {trips.map(trip => (
            <TripCard key={trip.id} trip={trip} onDeleteRequest={setConfirmTrip}/>
          ))}
        </div>
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
