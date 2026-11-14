import L from "leaflet";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { typeMeta, type Incident } from "@/lib/incidents";

const iconCache = new Map<string, string>();

function iconSvg(type: string) {
  const cached = iconCache.get(type);
  if (cached) return cached;
  const svg = renderToStaticMarkup(createElement(typeMeta(type).icon, { size: 15, strokeWidth: 2.4 }));
  iconCache.set(type, svg);
  return svg;
}

/** Leaflet divIcon for an incident: color by type, pulsing ring for active high-severity incidents. */
export function createIncidentIcon(incident: Pick<Incident, "type" | "severity" | "status">, selected = false) {
  const pulse = incident.severity === "high" && incident.status === "active";
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div class="ts-marker" data-type="${incident.type}" data-status="${incident.status}" data-selected="${selected}">${
      pulse ? '<span class="ts-marker__ring"></span>' : ""
    }<span class="ts-marker__dot">${iconSvg(incident.type)}</span></div>`,
  });
}

export function createClusterIcon(count: number) {
  return L.divIcon({
    className: "",
    iconSize: [42, 42],
    html: `<div class="ts-cluster" aria-label="${count} incidents">${count}</div>`,
  });
}

export const userIcon = () => L.divIcon({ className: "", iconSize: [18, 18], html: '<div class="ts-user-dot"></div>' });
export const pinIcon = () =>
  L.divIcon({ className: "", iconSize: [28, 28], iconAnchor: [14, 28], html: '<div class="ts-pin"></div>' });
