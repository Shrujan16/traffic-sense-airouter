export type LatLng = [number, number];

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLength(points: LatLng[]) {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1]!, points[i]!);
  return d;
}

/** Point at `distance` metres from `from` along `bearing` degrees. */
export function offset(from: LatLng, distance: number, bearing: number): LatLng {
  const δ = distance / R;
  const θ = toRad(bearing);
  const φ1 = toRad(from[0]);
  const λ1 = toRad(from[1]);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [toDeg(φ2), toDeg(λ2)];
}

function hashBearing(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 180;
}

export interface SuggestedRoute {
  path: LatLng[];
  start: LatLng;
  end: LatLng;
  distanceKm: number;
  altMinutes: number;
  directMinutes: number;
  timeSavedMinutes: number;
  source: "road" | "estimate";
}

/** Smooth arc that bends around the incident — used when road routing is unavailable. */
function syntheticDetour(start: LatLng, end: LatLng, via: LatLng): LatLng[] {
  const pts: LatLng[] = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const c = t ** 2;
    // control point exaggerated so the curve passes near `via`
    const cx = 2 * via[0] - (start[0] + end[0]) / 2;
    const cy = 2 * via[1] - (start[1] + end[1]) / 2;
    pts.push([a * start[0] + b * cx + c * end[0], a * start[1] + b * cy + c * end[1]]);
  }
  return pts;
}

async function osrm(points: LatLng[]): Promise<{ path: LatLng[]; distance: number; duration: number } | null> {
  const coords = points.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (json.code !== "Ok" || !r) return null;
    return { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng), distance: r.distance, duration: r.duration };
  } catch {
    return null;
  }
}

/**
 * Builds a plausible detour that avoids the incident: a start and end point ~1.2 km either
 * side of it, routed through a waypoint ~700 m off to the side.
 */
export async function buildAlternateRoute(
  incident: { id: string; lat: number; lng: number; estimated_delay: number },
): Promise<SuggestedRoute> {
  const center: LatLng = [incident.lat, incident.lng];
  const bearing = hashBearing(incident.id);
  const start = offset(center, 1200, bearing);
  const end = offset(center, 1200, bearing + 180);
  const via = offset(center, 750, bearing + 90);

  const [direct, alt] = await Promise.all([osrm([start, end]), osrm([start, via, end])]);
  const delay = Math.max(0, incident.estimated_delay);

  if (alt && direct) {
    const directMinutes = direct.duration / 60 + delay;
    const altMinutes = alt.duration / 60;
    return {
      path: alt.path,
      start,
      end,
      distanceKm: alt.distance / 1000,
      altMinutes,
      directMinutes,
      timeSavedMinutes: Math.round(directMinutes - altMinutes),
      source: "road",
    };
  }

  const path = syntheticDetour(start, end, via);
  const distance = pathLength(path);
  const directDistance = haversine(start, end);
  const speed = 22_000 / 60; // ~22 km/h city average, metres per minute
  const altMinutes = distance / speed;
  const directMinutes = directDistance / speed + delay;
  return {
    path,
    start,
    end,
    distanceKm: distance / 1000,
    altMinutes,
    directMinutes,
    timeSavedMinutes: Math.round(directMinutes - altMinutes),
    source: "estimate",
  };
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=in&viewbox=77.3,13.25,77.9,12.7&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Address search is unavailable right now");
  const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return json.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: shortLabel(r.display_name) }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = json.address ?? {};
    const road = a["road"] ?? a["pedestrian"] ?? a["neighbourhood"];
    const area = a["suburb"] ?? a["neighbourhood"] ?? a["city_district"] ?? a["quarter"];
    if (road && area && road !== area) return `${road}, ${area}`;
    if (road || area) return (road ?? area) as string;
    return json.display_name ? shortLabel(json.display_name) : null;
  } catch {
    return null;
  }
}

function shortLabel(display: string) {
  return display.split(",").slice(0, 2).map((s) => s.trim()).join(", ");
}
