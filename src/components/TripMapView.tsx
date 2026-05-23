"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const CAT_COLOR: Record<string, string> = {
  food: "#B65A37", cafe: "#B65A37", shop: "#B65A37",
  sauna: "#3F5A45", nature: "#3F5A45", family: "#3F5A45",
  museums: "#133A5B", history: "#133A5B", arch: "#133A5B",
  design: "#1A1611", night: "#C99544", events: "#C99544",
};

const CAT_ICON: Record<string, string> = {
  cafe:    `<path d="M5 7h10v6a2 2 0 01-2 2H7a2 2 0 01-2-2V7z" fill="none" stroke="white" stroke-width="1.5"/><path d="M15 9.5h1.5a1.5 1.5 0 010 3H15" fill="none" stroke="white" stroke-width="1.5"/>`,
  food:    `<path d="M9 4v5a3 3 0 006 0V4" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M12 13v6" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  sauna:   `<path d="M7 18c0-6 10-6 10-11" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M10 18c0-4 7-4 7-9" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  museums: `<path d="M3 10l9-6 9 6M5 10v9h14v-9M9 19v-5h2v5M13 19v-5h2v5" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  nature:  `<path d="M12 3l-7 12h14z" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 15v5" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  arch:    `<rect x="3" y="16" width="18" height="2" rx="1" fill="none" stroke="white" stroke-width="1.5"/><path d="M7 16V11a5 5 0 0110 0v5" fill="none" stroke="white" stroke-width="1.5"/>`,
  design:  `<path d="M12 3l2.5 5H19l-4 3 1.5 5-4.5-3-4.5 3 1.5-5-4-3h4.5z" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>`,
  history: `<circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 8v4.5l2.5 2" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  shop:    `<path d="M5 7h14l-1.5 9H6.5z" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 7l1-4h4l1 4" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  night:   `<path d="M21 12.8A9 9 0 0111.2 3 9 9 0 1021 12.8z" fill="none" stroke="white" stroke-width="1.5"/>`,
  family:  `<circle cx="9" cy="7" r="2.5" fill="none" stroke="white" stroke-width="1.5"/><circle cx="15" cy="7" r="2.5" fill="none" stroke="white" stroke-width="1.5"/><path d="M5 21v-2a5 5 0 0110 0v2" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
  events:  `<rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="white" stroke-width="1.5"/><path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/>`,
};

export interface MapActivity {
  id: string;
  completed: boolean;
  places: { category: string; lat: number; lng: number } | null;
}

export interface MapPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description?: string | null;
  address?: string | null;
  rating?: number | null;
  price_level?: number | null;
}

function makeTripMarkerEl(
  category: string,
  index: number,
  isActive: boolean,
  onClick: () => void,
): HTMLElement {
  const color    = CAT_COLOR[category] ?? "#B5A992";
  const icon     = CAT_ICON[category] ?? CAT_ICON.design ?? "";
  const size     = isActive ? 50 : 38;
  const iconSize = isActive ? 22 : 16;

  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:${size}px;height:${size + 10}px;cursor:pointer;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.28));`;
  wrap.addEventListener("click", onClick);

  const circle = document.createElement("div");
  circle.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #FAF7F1;display:flex;align-items:center;justify-content:center;position:absolute;top:0;left:0;`;
  circle.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">${icon}</svg>`;

  const tip = document.createElement("div");
  tip.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${color};`;

  if (isActive) {
    const badge = document.createElement("div");
    badge.style.cssText = `position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#C99544;border:2px solid #FAF7F1;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:9px;font-weight:800;color:#FAF7F1;z-index:1;`;
    badge.textContent = String(index + 1);
    wrap.appendChild(badge);
  }

  wrap.appendChild(circle);
  wrap.appendChild(tip);
  return wrap;
}

function makePlaceMarkerEl(
  category: string,
  isSelected: boolean,
  onClick: () => void,
): HTMLElement {
  const color = CAT_COLOR[category] ?? "#B5A992";
  const icon  = CAT_ICON[category] ?? CAT_ICON.design ?? "";
  const size  = isSelected ? 40 : 28;
  const iconSize = isSelected ? 18 : 12;

  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:${size}px;height:${size + 7}px;cursor:pointer;filter:drop-shadow(0 1px 5px rgba(0,0,0,0.2));`;
  wrap.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });

  const circle = document.createElement("div");
  circle.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${isSelected ? 1 : 0.65};border:${isSelected ? "2.5px" : "1.5px"} solid #FAF7F1;display:flex;align-items:center;justify-content:center;position:absolute;top:0;left:0;transition:opacity 0.15s;`;
  circle.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">${icon}</svg>`;

  const tip = document.createElement("div");
  tip.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${isSelected ? 5 : 4}px solid transparent;border-right:${isSelected ? 5 : 4}px solid transparent;border-top:7px solid ${color};opacity:${isSelected ? 1 : 0.65};`;

  wrap.appendChild(circle);
  wrap.appendChild(tip);
  return wrap;
}

export function TripMapView({
  activities,
  selectedIdx,
  onMarkerClick,
  allPlaces,
  selectedPlaceId,
  onPlaceClick,
}: {
  activities: MapActivity[];
  selectedIdx: number;
  onMarkerClick: (idx: number) => void;
  allPlaces?: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceClick?: (place: MapPlace) => void;
}) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const tripMarkersRef  = useRef<maplibregl.Marker[]>([]);
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [{ id: "bg", type: "raster", source: "carto" }],
      },
      center: [24.9354, 60.1699],
      zoom: 12.5,
      attributionControl: false,
    });
    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Place markers (background layer)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !allPlaces) return;

    const rebuild = () => {
      placeMarkersRef.current.forEach(m => m.remove());
      placeMarkersRef.current = [];

      allPlaces.forEach(place => {
        const isSelected = place.id === selectedPlaceId;
        const el = makePlaceMarkerEl(place.category, isSelected, () => onPlaceClick?.(place));
        const m = new maplibregl.Marker({ element: el, anchor: "center", offset: [0, 4] })
          .setLngLat([place.lng, place.lat])
          .addTo(map);
        placeMarkersRef.current.push(m);
      });
    };

    if (map.isStyleLoaded()) rebuild();
    else map.once("load", rebuild);
  }, [allPlaces, selectedPlaceId, onPlaceClick]);

  // Trip activity markers + route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = activities.filter(a => a.places?.lat && a.places?.lng);

    const rebuild = () => {
      tripMarkersRef.current.forEach(m => m.remove());
      tripMarkersRef.current = [];

      const coords = valid.map(a => [a.places!.lng, a.places!.lat] as [number, number]);

      const geojson = {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: coords },
        properties: {},
      };
      const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else if (coords.length >= 2) {
        map.addSource("route", { type: "geojson", data: geojson });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: { "line-color": "#B65A37", "line-width": 2.5, "line-opacity": 0.85 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
      }

      valid.forEach((act, i) => {
        const el = makeTripMarkerEl(
          act.places!.category,
          i,
          i === selectedIdx,
          () => onMarkerClick(i),
        );
        const m = new maplibregl.Marker({ element: el, anchor: "center", offset: [0, 5] })
          .setLngLat([act.places!.lng, act.places!.lat])
          .addTo(map);
        tripMarkersRef.current.push(m);
      });

      if (coords.length >= 2) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, {
          padding: { top: 110, right: 70, bottom: 220, left: 70 },
          duration: 700,
          maxZoom: 15,
        });
      } else if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: 15, duration: 500 });
      }
    };

    if (map.isStyleLoaded()) rebuild();
    else map.once("load", rebuild);
  }, [activities, selectedIdx, onMarkerClick]);

  // Fly to selected trip stop
  useEffect(() => {
    const map = mapRef.current;
    const act = activities[selectedIdx];
    if (!map || !act?.places || !map.isStyleLoaded()) return;
    map.flyTo({
      center: [act.places.lng, act.places.lat],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 500,
      offset: [0, -60],
    });
  }, [selectedIdx, activities]);

  // Fly to selected place
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlaceId || !allPlaces) return;
    const place = allPlaces.find(p => p.id === selectedPlaceId);
    if (!place || !map.isStyleLoaded()) return;
    map.flyTo({
      center: [place.lng, place.lat],
      zoom: Math.max(map.getZoom(), 14.5),
      duration: 500,
      offset: [0, -80],
    });
  }, [selectedPlaceId, allPlaces]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }}/>;
}
