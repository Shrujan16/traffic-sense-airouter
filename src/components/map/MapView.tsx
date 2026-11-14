import { useEffect, useRef } from "react";
import L from "leaflet";

import { BENGALURU_CENTER, typeMeta, type Incident } from "@/lib/incidents";
import type { LatLng, SuggestedRoute } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { createClusterIcon, createIncidentIcon, userIcon } from "./IncidentMarker";

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
  key: number;
}

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  route: SuggestedRoute | null;
  userLocation: LatLng | null;
  focus: MapFocus | null;
  className?: string;
}

type ClusterGroup = L.FeatureGroup & {
  addLayers: (layers: L.Layer[]) => void;
  removeLayers: (layers: L.Layer[]) => void;
  clearLayers: () => void;
};

export default function MapView({ incidents, selectedId, onSelect, route, userLocation, focus, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<ClusterGroup | null>(null);
  const markersRef = useRef(new Map<string, { marker: L.Marker; key: string }>());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const readyRef = useRef(false);
  const pendingRef = useRef<() => void>(() => {});

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(BENGALURU_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    routeLayerRef.current = L.layerGroup().addTo(map);

    let cancelled = false;
    (window as unknown as { L: typeof L }).L = L;
    void import("leaflet.markercluster").then(() => {
      if (cancelled) return;
      const group = (L as unknown as { markerClusterGroup: (o: object) => ClusterGroup }).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (c: { getChildCount: () => number }) => createClusterIcon(c.getChildCount()),
      });
      map.addLayer(group);
      clusterRef.current = group;
      readyRef.current = true;
      pendingRef.current();
    });

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
      readyRef.current = false;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const sync = () => {
      const group = clusterRef.current;
      if (!group) return;
      const existing = markersRef.current;
      const nextIds = new Set(incidents.map((i) => i.id));
      const toRemove: L.Layer[] = [];
      existing.forEach((v, id) => {
        if (!nextIds.has(id)) {
          toRemove.push(v.marker);
          existing.delete(id);
        }
      });
      if (toRemove.length) group.removeLayers(toRemove);

      const toAdd: L.Layer[] = [];
      for (const inc of incidents) {
        const selected = inc.id === selectedId;
        const key = `${inc.type}|${inc.severity}|${inc.status}|${selected}|${inc.lat}|${inc.lng}`;
        const found = existing.get(inc.id);
        if (found) {
          if (found.key !== key) {
            found.marker.setIcon(createIncidentIcon(inc, selected));
            found.marker.setLatLng([inc.lat, inc.lng]);
            found.marker.setZIndexOffset(selected ? 1000 : 0);
            found.key = key;
          }
          continue;
        }
        const marker = L.marker([inc.lat, inc.lng], {
          icon: createIncidentIcon(inc, selected),
          keyboard: true,
          title: `${typeMeta(inc.type).label} at ${inc.location_name}`,
          alt: `${typeMeta(inc.type).label} at ${inc.location_name}`,
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : 0,
        });
        marker.on("click", () => onSelectRef.current(inc.id));
        marker.on("keypress", (e: L.LeafletKeyboardEvent) => {
          if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") onSelectRef.current(inc.id);
        });
        existing.set(inc.id, { marker, key });
        toAdd.push(marker);
      }
      if (toAdd.length) group.addLayers(toAdd);
    };
    if (readyRef.current) sync();
    else pendingRef.current = sync;
  }, [incidents, selectedId]);

  // Focus / fly to
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focus]);

  // Suggested route
  useEffect(() => {
    const layer = routeLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (!route) return;
    const teal = getComputedStyle(document.documentElement).getPropertyValue("--teal").trim() || "#14B8A6";
    L.polyline(route.path, { color: "#ffffff", weight: 9, opacity: 0.9 }).addTo(layer);
    const line = L.polyline(route.path, { color: teal, weight: 5, opacity: 1, dashArray: route.source === "estimate" ? "10 8" : undefined }).addTo(layer);
    L.circleMarker(route.start, { radius: 7, color: "#fff", weight: 3, fillColor: teal, fillOpacity: 1 })
      .bindTooltip("Start", { direction: "top" })
      .addTo(layer);
    L.circleMarker(route.end, { radius: 7, color: "#fff", weight: 3, fillColor: teal, fillOpacity: 1 })
      .bindTooltip("End", { direction: "top" })
      .addTo(layer);
    const mid = route.path[Math.floor(route.path.length / 2)];
    if (mid) {
      L.tooltip({ permanent: true, direction: "center", className: "ts-route-label" })
        .setLatLng(mid)
        .setContent(`Suggested route · ${route.distanceKm.toFixed(1)} km`)
        .addTo(layer);
    }
    map.fitBounds(line.getBounds(), { padding: [80, 80], maxZoom: 16 });
  }, [route]);

  // User location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (userLocation) {
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon(), title: "Your location", zIndexOffset: 2000 }).addTo(map);
    }
  }, [userLocation]);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", className)}
      role="application"
      aria-label="Live traffic incident map of Bengaluru"
    />
  );
}
