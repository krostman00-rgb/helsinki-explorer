"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripDay, TripActivity } from "@/types/database.types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

interface TripDayWithActivities extends TripDay {
  trip_activities: TripActivity[];
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDayWithActivities[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase.from("trips").select("*").eq("id", params.id).single(),
      supabase
        .from("trip_days")
        .select("*, trip_activities(*)")
        .eq("trip_id", params.id)
        .order("day_number"),
    ]).then(([tripRes, daysRes]) => {
      setTrip(tripRes.data);
      setDays((daysRes.data as TripDayWithActivities[]) ?? []);
      setIsLoading(false);
    });
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-4rem)]">
        <p className="text-muted-foreground">Ladataan...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] gap-4">
        <p className="text-muted-foreground">Matkaa ei löydy.</p>
        <Link href="/trips" className={buttonVariants({ variant: "outline" })}>
          ← Takaisin
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/trips"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-2")}
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">{trip.title}</h1>
      </div>

      {/* Trip metadata */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={14} />
          {trip.duration_days} päivää
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={14} />
          Helsinki
        </span>
        <span>{"€".repeat(trip.budget_level)}</span>
      </div>

      {/* Day list */}
      {days.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Päiväohjelma generoidaan pian.
            <br />
            Tämä ominaisuus valmistuu seuraavassa versiossa.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.id} className="rounded-xl border border-border p-4 space-y-3">
              <h2 className="font-semibold">
                Päivä {day.day_number}
                {day.title ? ` — ${day.title}` : ""}
              </h2>

              {day.trip_activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ei aktiviteetteja vielä.</p>
              ) : (
                <ul className="space-y-2">
                  {day.trip_activities.map((activity) => (
                    <li
                      key={activity.id}
                      className={`flex items-start gap-2 text-sm ${
                        activity.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                      {activity.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
