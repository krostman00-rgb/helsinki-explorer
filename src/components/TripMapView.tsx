"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
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

interface TripMarkerHandle {
  el: HTMLElement;
  setActive: (active: boolean, index: number) => void;
}

interface PlaceMarkerHandle {
  el: HTMLElement;
  setSelected: (selected: boolean) => void;
}

function makeTripMarker(
  category: string,
  index: number,
  isActive: boolean,
  onClick: () => void,
): TripMarkerHandle {
  const color = CAT_COLOR[category] ?? "#B5A992";
  const icon  = CAT_ICON[category] ?? CAT_ICON.design ?? "";

  // Outer wrap — MapLibre OWNS its `position` and `transform`. We MUST NOT
  // override them via `style.cssText`. Only set non-positioning styles here,
  // and use individual style properties (never cssText) for size updates.
  const wrap = document.createElement("div");
  wrap.style.cursor = "pointer";
  wrap.style.filter = "drop-shadow(0 2px 8px rgba(0,0,0,0.28))";
  wrap.addEventListener("click", onClick);

  // Children (badge/circle/tip) are absolute and positioned against the wrap,
  // which becomes `position:absolute` via MapLibre's `.maplibregl-marker` class.
  const circle = document.createElement("div");
  const tip    = document.createElement("div");
  const badge  = document.createElement("div");

  wrap.appendChild(badge);
  wrap.appendChild(circle);
  wrap.appendChild(tip);

  const apply = (active: boolean, idx: number) => {
    const size     = active ? 50 : 38;
    const iconSize = active ? 22 : 16;

    // Resize wrap with INDIVIDUAL properties (not cssText) so MapLibre's
    // inline `transform` survives.
    wrap.style.width  = `${size}px`;
    wrap.style.height = `${size + 10}px`;

    circle.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #FAF7F1;display:flex;align-items:center;justify-content:center;position:absolute;top:0;left:0;`;
    circle.innerHTML     = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">${icon}</svg>`;

    tip.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${color};`;

    badge.style.cssText = `position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#C99544;border:2px solid #FAF7F1;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:9px;font-weight:800;color:#FAF7F1;z-index:1;`;
    badge.style.display = active ? "flex" : "none";
    badge.textContent   = String(idx + 1);
  };

  apply(isActive, index);

  return { el: wrap, setActive: apply };
}

function makePlaceMarker(
  category: string,
  onClick: () => void,
): PlaceMarkerHandle {
  const color = CAT_COLOR[category] ?? "#B5A992";
  const icon  = CAT_ICON[category] ?? CAT_ICON.design ?? "";

  // Same approach as makeTripMarker — don't touch position or transform.
  const wrap = document.createElement("div");
  wrap.style.cursor = "pointer";
  wrap.style.filter = "drop-shadow(0 1px 5px rgba(0,0,0,0.2))";
  wrap.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });

  const circle = document.createElement("div");
  const tip    = document.createElement("div");

  wrap.appendChild(circle);
  wrap.appendChild(tip);

  const apply = (selected: boolean) => {
    const size     = selected ? 40 : 28;
    const iconSize = selected ? 18 : 12;
    const opacity  = selected ? 1 : 0.65;

    wrap.style.width  = `${size}px`;
    wrap.style.height = `${size + 7}px`;

    circle.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${opacity};border:${selected ? "2.5px" : "1.5px"} solid #FAF7F1;display:flex;align-items:center;justify-content:center;position:absolute;top:0;left:0;transition:all 0.15s;`;
    circle.innerHTML     = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24">${icon}</svg>`;

    tip.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${selected ? 5 : 4}px solid transparent;border-right:${selected ? 5 : 4}px solid transparent;border-top:7px solid ${color};opacity:${opacity};transition:opacity 0.15s;`;
  };

  apply(false);

  return { el: wrap, setSelected: apply };
}

export interface AccommodationMarker {
  name: string;
  lat: number;
  lng: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface TripMapViewHandle {
  /** Imperatively recenter the map on a coordinate. Bypasses useEffect timing
   *  so the call wins against any other flyTo scheduled in the same tick. */
  flyToLocation: (lat: number, lng: number, zoom?: number) => void;
}

interface TripMapViewProps {
  activities: MapActivity[];
  selectedIdx: number;
  onMarkerClick: (idx: number) => void;
  allPlaces?: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceClick?: (place: MapPlace) => void;
  accommodation?: AccommodationMarker | null;
  userLocation?: UserLocation | null;
}

export const TripMapView = forwardRef<TripMapViewHandle, TripMapViewProps>(function TripMapView({
  activities,
  selectedIdx,
  onMarkerClick,
  allPlaces,
  selectedPlaceId,
  onPlaceClick,
  accommodation,
  userLocation,
}, forwardedRef) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<maplibregl.Map | null>(null);
  const stayMarkerRef     = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef     = useRef<maplibregl.Marker | null>(null);

  // Trip markers
  const tripMarkersRef  = useRef<maplibregl.Marker[]>([]);
  const tripHandlesRef  = useRef<TripMarkerHandle[]>([]);
  const prevTripIdxRef  = useRef<number>(-1);

  // Place markers
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const placeHandlesRef = useRef<Map<string, PlaceMarkerHandle>>(new Map());
  const prevPlaceIdRef  = useRef<string | null>(null);

  // Refs for current prop values (avoid stale closure in effects)
  const selectedIdxRef      = useRef(selectedIdx);
  const selectedPlaceIdRef  = useRef(selectedPlaceId ?? null);
  useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);
  useEffect(() => { selectedPlaceIdRef.current = selectedPlaceId ?? null; }, [selectedPlaceId]);

  // Init map once
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
      center: [24.9354, 60.1650],
      zoom: 11.5,
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

  // ── Place markers: rebuild only when places list or click handler changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !allPlaces) return;

    const rebuild = () => {
      placeMarkersRef.current.forEach(m => m.remove());
      placeMarkersRef.current = [];
      placeHandlesRef.current.clear();
      prevPlaceIdRef.current = null;

      const curSelected = selectedPlaceIdRef.current;

      allPlaces.forEach(place => {
        const handle = makePlaceMarker(place.category, () => onPlaceClick?.(place));
        if (place.id === curSelected) handle.setSelected(true);
        placeHandlesRef.current.set(place.id, handle);
        const m = new maplibregl.Marker({ element: handle.el, anchor: "bottom" })
          .setLngLat([place.lng, place.lat])
          .addTo(map);
        placeMarkersRef.current.push(m);
      });

      prevPlaceIdRef.current = curSelected;
    };

    if (map.isStyleLoaded()) rebuild();
    else map.once("load", rebuild);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlaces, onPlaceClick]);

  // ── Place selection: mutate DOM directly, no marker rebuild ──
  useEffect(() => {
    const next = selectedPlaceId ?? null;
    const prev = prevPlaceIdRef.current;
    if (prev === next) return;
    if (prev) placeHandlesRef.current.get(prev)?.setSelected(false);
    if (next) placeHandlesRef.current.get(next)?.setSelected(true);
    prevPlaceIdRef.current = next;
  }, [selectedPlaceId]);

  // ── Trip markers: rebuild when activity list changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = activities.filter(a => a.places?.lat && a.places?.lng);

    const rebuild = () => {
      tripMarkersRef.current.forEach(m => m.remove());
      tripMarkersRef.current = [];
      tripHandlesRef.current = [];
      prevTripIdxRef.current = -1;

      const curIdx = selectedIdxRef.current;
      const coords = valid.map(a => [a.places!.lng, a.places!.lat] as [number, number]);

      // Route line
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
        const handle = makeTripMarker(act.places!.category, i, i === curIdx, () => onMarkerClick(i));
        tripHandlesRef.current.push(handle);
        const m = new maplibregl.Marker({ element: handle.el, anchor: "bottom" })
          .setLngLat([act.places!.lng, act.places!.lat])
          .addTo(map);
        tripMarkersRef.current.push(m);
      });

      prevTripIdxRef.current = curIdx;

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, onMarkerClick]);

  // ── Trip selection: mutate DOM directly ──
  useEffect(() => {
    const prev = prevTripIdxRef.current;
    if (prev === selectedIdx) return;
    if (prev >= 0) tripHandlesRef.current[prev]?.setActive(false, prev);
    if (selectedIdx >= 0) tripHandlesRef.current[selectedIdx]?.setActive(true, selectedIdx);
    prevTripIdxRef.current = selectedIdx;
  }, [selectedIdx]);

  // ── Fly to selected trip stop ──
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

  // ── Fly to selected place ──
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

  // ── Accommodation (STAY) marker ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addStay = () => {
      // Remove old marker if any
      stayMarkerRef.current?.remove();
      stayMarkerRef.current = null;

      if (!accommodation?.lat || !accommodation?.lng) return;

      const el = document.createElement("div");
      el.style.cssText = `
        background:#1A1714;color:white;
        padding:5px 10px;border-radius:20px;
        font-size:11px;font-weight:600;letter-spacing:0.05em;
        display:flex;align-items:center;gap:5px;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        white-space:nowrap;cursor:default;
      `;
      el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>STAY</span>`;

      const popup = new maplibregl.Popup({ offset: 28, closeButton: false })
        .setHTML(`<strong style="font-family:sans-serif;font-size:13px">${accommodation.name}</strong><br><span style="font-family:sans-serif;font-size:11px;color:#888">Your base</span>`);

      stayMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([accommodation.lng, accommodation.lat])
        .setPopup(popup)
        .addTo(map);
    };

    if (map.isStyleLoaded()) addStay();
    else map.once("load", addStay);
  }, [accommodation]);

  // ── User location ("you are here") marker — JUST marker, no flyTo ──
  // The flyTo is triggered imperatively via forwardedRef.flyToLocation()
  // to avoid race conditions with the trip activity effects that re-fire
  // on every render (because `activities` is a new array reference).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addUserMarker = () => {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;

      if (!userLocation?.lat || !userLocation?.lng) return;

      if (!document.getElementById("hh-gps-pulse")) {
        const s = document.createElement("style");
        s.id = "hh-gps-pulse";
        s.textContent = "@keyframes hhGpsPulse{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(2.2);opacity:0}}";
        document.head.appendChild(s);
      }

      const wrap = document.createElement("div");
      wrap.style.cssText = "width:22px;height:22px;position:relative;pointer-events:none;";

      const pulse = document.createElement("div");
      pulse.style.cssText = "position:absolute;inset:0;border-radius:50%;background:rgba(0,122,255,0.28);animation:hhGpsPulse 1.8s ease-out infinite;";

      const dot = document.createElement("div");
      dot.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#007AFF;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,122,255,0.45);";

      wrap.appendChild(pulse);
      wrap.appendChild(dot);

      userMarkerRef.current = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    };

    if (map.isStyleLoaded()) addUserMarker();
    else map.once("load", addUserMarker);
  }, [userLocation]);

  // ── Imperative handle: lets parent fly map AFTER React effects settle ──
  useImperativeHandle(forwardedRef, () => ({
    flyToLocation: (lat: number, lng: number, zoom = 15) => {
      const map = mapRef.current;
      if (!map) return;
      const doFly = () => map.flyTo({
        center: [lng, lat],
        zoom,
        duration: 900,
        essential: true,
      });
      // Schedule on the NEXT animation frame so any pending
      // useEffect-driven flyTo/fitBounds calls fire first and we win.
      if (map.isStyleLoaded()) requestAnimationFrame(doFly);
      else map.once("load", () => requestAnimationFrame(doFly));
    },
  }), []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }}/>;
});
