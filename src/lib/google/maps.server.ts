const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface GRoute {
  duration?: string;
  staticDuration?: string;
  distanceMeters?: number;
  polyline?: { encodedPolyline?: string };
  travelAdvisory?: { speedReadingIntervals?: unknown[] };
  legs?: {
    steps?: {
      distanceMeters?: number;
      navigationInstruction?: { maneuver?: string; instructions?: string };
    }[];
  }[];
}

/** "123.4s" -> 123.4 */
export function parseDuration(d: string | undefined): number | null {
  if (!d) return null;
  const n = Number.parseFloat(d.replace(/s$/, ""));
  return Number.isFinite(n) ? n : null;
}

type Point = [number, number];
const waypoint = ([lat, lng]: Point, via = false) => ({ location: { latLng: { latitude: lat, longitude: lng } }, ...(via ? { via: true } : {}) });

/** Calls the Google Routes API (computeRoutes) through the connector gateway. */
export async function computeRoutes(opts: {
  origin: Point;
  destination: Point;
  via?: Point[];
  alternatives?: boolean;
  trafficOnPolyline?: boolean;
  fieldMask: string;
}): Promise<GRoute[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) throw new Error("Google Maps is not connected");

  const body: Record<string, unknown> = {
    origin: waypoint(opts.origin),
    destination: waypoint(opts.destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    languageCode: "en-IN",
    regionCode: "IN",
    units: "METRIC",
  };
  if (opts.via?.length) body["intermediates"] = opts.via.map((p) => waypoint(p, true));
  if (opts.alternatives && !opts.via?.length) body["computeAlternativeRoutes"] = true;
  if (opts.trafficOnPolyline) body["extraComputations"] = ["TRAFFIC_ON_POLYLINE"];

  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": opts.fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 403) {
    const text = await res.text();
    console.error(`Google Routes denied [403]: ${text.slice(0, 500)}`);
    throw new Error("Google Maps denied the route request. Check the Google Maps key's allowed APIs.");
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`Google Routes failed [${res.status}]: ${text.slice(0, 500)}`);
    throw new Error(`Google route request failed (${res.status})`);
  }
  const json = (await res.json()) as { routes?: GRoute[] };
  return json.routes ?? [];
}
