"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createClient } from "@/lib/supabase/client";
import type { Place } from "@/types/database.types";

const HELSINKI_CENTER: [number, number] = [24.9354, 60.1699];
const DEFAULT_ZOOM = 12.5;

const CATEGORY_COLOR: Record<string, string> = {
  food:    "#B65A37",
  cafe:    "#B65A37",
  shop:    "#B65A37",
  sauna:   "#3F5A45",
  nature:  "#3F5A45",
  family:  "#3F5A45",
  museums: "#133A5B",
  history: "#133A5B",
  arch:    "#133A5B",
  design:  "#1A1611",
  night:   "#C99544",
  events:  "#C99544",
};

function makeDot(color: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `width:11px;height:11px;border-radius:50%;background:${color};border:2.5px solid #FAF7F1;box-shadow:0 1px 5px rgba(0,0,0,0.28);cursor:pointer;transition:transform 0.12s;`;
  el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.45)"; });
  el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
  return el;
}

export function MapView({ activeCategory }: { activeCategory?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Array<{ marker: maplibregl.Marker; category: string }>>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    createClient().from("places").select("*").then(({ data }) => {
      if (data) setPlaces(data);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm-tiles" }],
      },
      center: HELSINKI_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !places.length) return;

    const add = () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];

      places.forEach(place => {
        const color = CATEGORY_COLOR[place.category] ?? "#B5A992";
        const el = makeDot(color);

        const popup = new maplibregl.Popup({ offset: 14, closeButton: false, maxWidth: "220px" })
          .setHTML(
            `<div style="font-family:system-ui,sans-serif;padding:2px 0">` +
            `<div style="font-size:13px;font-weight:600;color:#1A1611;line-height:1.2;margin-bottom:3px">${place.name}</div>` +
            (place.address ? `<div style="font-size:11px;color:#B5A992;line-height:1.4">${place.address}</div>` : "") +
            `</div>`
          );

        const m = new maplibregl.Marker({ element: el })
          .setLngLat([place.lng, place.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push({ marker: m, category: place.category });
      });
    };

    if (map.isStyleLoaded()) {
      add();
    } else {
      map.once("load", add);
    }
  }, [places]);

  // Show/hide markers based on active category filter
  useEffect(() => {
    markersRef.current.forEach(({ marker, category }) => {
      const el = marker.getElement();
      if (!activeCategory || category === activeCategory) {
        el.style.display = "";
      } else {
        el.style.display = "none";
        marker.getPopup()?.remove();
      }
    });
  }, [activeCategory]);

  return <div ref={containerRef} className="w-full h-full" />;
}
