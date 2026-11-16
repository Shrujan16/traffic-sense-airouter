import { decodePolyline, distanceToPath, type LatLng } from "./geo";
import { severityMeta, typeMeta, type Incident } from "./incidents";

/** Google live traffic is cached and refreshed at most this often. */
export const TRAFFIC_REFRESH_SECONDS = 15 * 60;

export interface CorridorDef {
  id: string;
  name: string;
  origin: LatLng;
  destination: LatLng;
}

/** Main Bengaluru stretches whose live travel time is tracked. */
export const CORRIDORS: CorridorDef[] = [
  { id: "orr-silkboard-marathahalli", name: "Outer Ring Road: Silk Board → Marathahalli", origin: [12.9172, 77.6229], destination: [12.9569, 77.7011] },
  { id: "orr-marathahalli-krpuram", name: "Outer Ring Road: Marathahalli → KR Puram", origin: [12.9569, 77.7011], destination: [13.005, 77.696] },
  { id: "orr-hebbal-krpuram", name: "Outer Ring Road: Hebbal → KR Puram", origin: [13.0358, 77.597], destination: [13.005, 77.696] },
  { id: "hosur-silkboard-ecity", name: "Hosur Road: Silk Board → Electronic City", origin: [12.9172, 77.6229], destination: [12.8452, 77.6602] },
  { id: "bellary-mekhri-yelahanka", name: "Bellary Road: Mekhri Circle → Yelahanka", origin: [13.0145, 77.5835], destination: [13.1007, 77.5963] },
  { id: "omr-ulsoor-tinfactory", name: "Old Madras Road: Ulsoor → Tin Factory", origin: [12.981, 77.627], destination: [12.9965, 77.668] },
  { id: "tumkur-yeshwanthpur-8thmile", name: "Tumkur Road: Yeshwanthpur → 8th Mile", origin: [13.0236, 77.5508], destination: [13.0569, 77.4997] },
  { id: "mysore-sirsi-kengeri", name: "Mysore Road: Sirsi Circle → Kengeri", origin: [12.958, 77.563], destination: [12.912, 77.485] },
  { id: "bannerghatta-dairy-hulimavu", name: "Bannerghatta Road: Dairy Circle → Hulimavu", origin: [12.939, 77.601], destination: [12.877, 77.596] },
  { id: "kanakapura-banashankari-konanakunte", name: "Kanakapura Road: Banashankari → Konanakunte", origin: [12.9255, 77.5468], destination: [12.885, 77.556] },
  { id: "whitefield-marathahalli-itpl", name: "Whitefield Road: Marathahalli → ITPL", origin: [12.9569, 77.7011], destination: [12.985, 77.73] },
  { id: "sarjapur-agara-wipro", name: "Sarjapur Road: Agara → Wipro Junction", origin: [12.923, 77.65], destination: [12.9, 77.695] },
  { id: "airport-domlur-marathahalli", name: "Old Airport Road: Domlur → Marathahalli", origin: [12.961, 77.639], destination: [12.9569, 77.7011] },
];

export type SpeedLevel = "NORMAL" | "SLOW" | "TRAFFIC_JAM";
export interface SpeedInterval {
  startPolylinePointIndex?: number;
  endPolylinePointIndex?: number;
  speed?: SpeedLevel;
}

export interface CorridorRow {
  id: string;
  name: string;
  encoded_polyline: string;
  distance_m: number;
  duration_s: number;
  static_duration_s: number;
  speed_intervals: unknown;
  updated_at: string;
}

export type CongestionLevel = "clear" | "slow" | "jam";

export interface LiveCorridor {
  id: string;
  name: string;
  path: LatLng[];
  segments: { path: LatLng[]; speed: SpeedLevel }[];
  distanceKm: number;
  durationMin: number;
  usualMin: number;
  delayMin: number;
  level: CongestionLevel;
  updatedAt: string;
}

/** Congestion level from the extra minutes compared with the usual (no-traffic) time. */
export function congestionLevel(delayMin: number, usualMin: number): CongestionLevel {
  const ratio = usualMin > 0 ? (usualMin + delayMin) / usualMin : 1;
  if (delayMin >= 10 || ratio >= 1.6) return "jam";
  if (delayMin >= 3 || ratio >= 1.25) return "slow";
  return "clear";
}

export const LEVEL_META: Record<CongestionLevel, { label: string; color: string; soft: string }> = {
  clear: { label: "Moving well", color: "#22C55E", soft: "bg-sev-low/12 text-sev-low border-sev-low/30" },
  slow: { label: "Slow", color: "#F59E0B", soft: "bg-sev-medium/15 text-sev-medium border-sev-medium/40" },
  jam: { label: "Jammed", color: "#EF4444", soft: "bg-sev-high/12 text-sev-high border-sev-high/30" },
};

export const SPEED_COLOR: Record<SpeedLevel, string> = {
  NORMAL: LEVEL_META.clear.color,
  SLOW: LEVEL_META.slow.color,
  TRAFFIC_JAM: LEVEL_META.jam.color,
};

export function toLiveCorridor(row: CorridorRow): LiveCorridor {
  const path = row.encoded_polyline ? decodePolyline(row.encoded_polyline) : [];
  const intervals = Array.isArray(row.speed_intervals) ? (row.speed_intervals as SpeedInterval[]) : [];
  const segments = intervals.length
    ? intervals
        .map((iv) => {
          // Protobuf JSON omits zero-valued indexes.
          const start = iv.startPolylinePointIndex ?? 0;
          const end = iv.endPolylinePointIndex ?? 0;
          return { path: path.slice(start, end + 1), speed: iv.speed ?? "NORMAL" };
        })
        .filter((s) => s.path.length > 1)
    : [{ path, speed: "NORMAL" as SpeedLevel }];
  const durationMin = row.duration_s / 60;
  const usualMin = row.static_duration_s / 60;
  const delayMin = Math.max(0, Math.round(durationMin - usualMin));
  return {
    id: row.id,
    name: row.name,
    path,
    segments,
    distanceKm: row.distance_m / 1000,
    durationMin: Math.round(durationMin),
    usualMin: Math.round(usualMin),
    delayMin,
    level: congestionLevel(delayMin, usualMin),
    updatedAt: row.updated_at,
  };
}

/** Bengaluru peak hours (IST): 8–11 am and 5–9 pm. */
export function isPeakHour(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  const h = ist.getUTCHours();
  return (h >= 8 && h < 11) || (h >= 17 && h < 21);
}

/** Active incidents within `radius` metres of the corridor, most severe first. */
export function incidentsOnCorridor(corridor: Pick<LiveCorridor, "path">, incidents: Incident[], radius = 400) {
  return incidents
    .filter((i) => i.status === "active" && distanceToPath([i.lat, i.lng], corridor.path) <= radius)
    .sort((a, b) => severityMeta(b.severity).rank - severityMeta(a.severity).rank || b.estimated_delay - a.estimated_delay);
}

/** Plain-language reason for a corridor's current congestion. */
export function explainCorridor(corridor: LiveCorridor, incidents: Incident[], now = new Date()) {
  const causes = incidentsOnCorridor(corridor, incidents);
  const top = causes[0];
  if (corridor.level === "clear") {
    return { causes, text: top ? `Traffic is moving well, though there is a reported ${typeMeta(top.type).label.toLowerCase()} at ${top.location_name}.` : "Traffic is moving normally on this stretch." };
  }
  if (top) {
    const more = causes.length > 1 ? ` plus ${causes.length - 1} more report${causes.length > 2 ? "s" : ""} on this road` : "";
    return { causes, text: `Likely caused by a ${typeMeta(top.type).label.toLowerCase()} at ${top.location_name}${more}. ${top.ai_likely_cause ?? ""}`.trim() };
  }
  return {
    causes,
    text: isPeakHour(now)
      ? "No incident has been reported here. The slowdown matches usual peak-hour volume."
      : "No incident has been reported here yet. If you can see what's causing it, report it to help others.",
  };
}
