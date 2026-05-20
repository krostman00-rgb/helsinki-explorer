"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/types/database.types";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Backpack, Plus } from "lucide-react";

export default function TripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    supabase
      .from("trips")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTrips(data ?? []);
        setIsLoading(false);
      });
  }, [user]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <p className="text-muted-foreground">Ladataan...</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matkani</h1>
        <Link
          href="/onboarding"
          className={cn(buttonVariants({ size: "sm" }), "gap-1")}
        >
          <Plus size={16} />
          Uusi matka
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Backpack size={48} strokeWidth={1} className="text-muted-foreground" />
          <p className="text-muted-foreground">
            Sinulla ei ole vielä matkoja.
            <br />
            Aloita suunnittelu!
          </p>
          <Link href="/onboarding" className={buttonVariants({})}>
            Luo ensimmäinen matka
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="block p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">{trip.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {trip.duration_days} päivää ·{" "}
                      {"€".repeat(trip.budget_level)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      trip.status === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : trip.status === "completed"
                        ? "bg-muted text-muted-foreground"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}
                  >
                    {trip.status === "active"
                      ? "Aktiivinen"
                      : trip.status === "completed"
                      ? "Valmis"
                      : "Suunnittelu"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
