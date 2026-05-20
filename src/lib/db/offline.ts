import Dexie, { type EntityTable } from "dexie";
import type { Place, Trip, TripDay, TripActivity } from "@/types/database.types";

// Local offline cache — mirrors the Supabase schema for offline-first reads
class HelsinkiExplorerDB extends Dexie {
  places!: EntityTable<Place, "id">;
  trips!: EntityTable<Trip, "id">;
  tripDays!: EntityTable<TripDay, "id">;
  tripActivities!: EntityTable<TripActivity, "id">;

  constructor() {
    super("helsinki-explorer");

    this.version(1).stores({
      places: "id, category, lat, lng",
      trips: "id, user_id, status, created_at",
      tripDays: "id, trip_id, day_number",
      tripActivities: "id, trip_day_id, order_index, completed",
    });
  }
}

// Singleton — one DB connection shared across the app
export const offlineDb = new HelsinkiExplorerDB();
