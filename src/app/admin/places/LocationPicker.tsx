"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  onPick: (loc: PickedLocation) => void;
  initialLat?: number;
  initialLng?: number;
}

// ── Nominatim reverse geocoding ───────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fi`,
      { headers: { "User-Agent": "HelloHel-Admin/1.0" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const a = data.address ?? {};

    // Build a clean street address
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    const area   = a.suburb || a.neighbourhood || a.quarter || a.district || "";
    const city   = a.city || a.town || a.municipality || "";
    return [street, area, city].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

// ── Component ─────────────────────────────────────────────────
export default function LocationPicker({
  onPick,
  initialLat,
  initialLng,
}: LocationPickerProps) {
  const [expanded, setExpanded]       = useState(false);
  const [geocoding, setGeocoding]     = useState(false);
  const [statusText, setStatusText]   = useState("Klikkaa tai vedä merkki paikalleen");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const markerRef       = useRef<maplibregl.Marker | null>(null);
  // keep onPick stable in callbacks
  const onPickRef       = useRef(onPick);
  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  const handlePick = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    setStatusText("Haetaan osoitetta…");
    const address = await reverseGeocode(lat, lng);
    setGeocoding(false);
    setStatusText(address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    onPickRef.current({ lat, lng, address });
  }, []);

  // Init / destroy map when expanded changes
  useEffect(() => {
    if (!expanded) {
      mapRef.current?.remove();
      mapRef.current  = null;
      markerRef.current = null;
      return;
    }

    if (!mapContainerRef.current) return;

    const centerLat = initialLat ?? 60.1699;
    const centerLng = initialLng ?? 24.9384;
    const zoom      = initialLat ? 15 : 12;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
            maxzoom: 19,
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [centerLng, centerLat],
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Custom copper-coloured marker element
    const el = document.createElement("div");
    el.style.cssText = [
      "width:32px", "height:32px",
      "background:#C96E48",
      "border:3px solid #FAF7F1",
      "border-radius:50% 50% 50% 0",
      "transform:rotate(-45deg)",
      "box-shadow:0 3px 10px rgba(0,0,0,0.35)",
      "cursor:grab",
      "transition:transform 0.15s",
    ].join(";");
    el.addEventListener("mousedown", () => { el.style.cursor = "grabbing"; });
    el.addEventListener("mouseup",   () => { el.style.cursor = "grab"; });

    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom-left" })
      .setLngLat([centerLng, centerLat])
      .addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      handlePick(lat, lng);
    });

    map.on("click", (e) => {
      const { lat, lng } = e.lngLat;
      marker.setLngLat([lng, lat]);
      map.easeTo({ center: [lng, lat], duration: 200 });
      handlePick(lat, lng);
    });

    // If editing an existing place, show its location immediately
    if (initialLat && initialLng) {
      handlePick(initialLat, initialLng);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current   = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setExpanded(v => !v)}
        className="w-fit gap-1.5"
      >
        <MapPin className="size-4" />
        {expanded ? "Sulje kartta" : "Valitse kartalta"}
      </Button>

      {expanded && (
        <div
          className="relative rounded-xl overflow-hidden border border-border"
          style={{ height: 300 }}
        >
          {/* MapLibre container */}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Status bar at bottom */}
          <div className="absolute bottom-2 left-2 right-12 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-foreground shadow-sm pointer-events-none">
            {geocoding
              ? <><Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" /> Haetaan osoitetta…</>
              : <><MapPin className="size-3 shrink-0 text-copper-600" /> {statusText}</>
            }
          </div>
        </div>
      )}
    </div>
  );
}
