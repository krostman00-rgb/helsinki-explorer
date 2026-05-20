"use client";

import dynamic from "next/dynamic";

// MapLibre GL uses browser APIs (window, WebGL) — must be loaded client-side only
const MapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted animate-pulse" /> }
);

export default function MapPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 4rem)" }}>
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold">Kartta</h1>
        <p className="text-xs text-muted-foreground">Helsinki, Suomi</p>
      </div>
      <div className="flex-1">
        <MapView />
      </div>
    </div>
  );
}
