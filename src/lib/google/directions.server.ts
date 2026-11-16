import { decodePolyline, distanceToPath, haversine, offset, type LatLng, type RouteStep, type SuggestedRoute } from "@/lib/geo";
import { computeRoutes, parseDuration, type GRoute } from "./maps.server";

const FIELD_MASK = [
  "routes.duration",
  "routes.staticDuration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.navigationInstruction",
].join(",");

/** A route counts as passing the incident within this distance, and as avoiding it beyond AVOID_M. */
const THROUGH_M = 250;
const AVOID_M = 400;

interface Candidate {
  route: GRoute;
  path: LatLng[];
  seconds: number;
  staticSeconds: number;
  minDist: number;
}

function toCandidate(route: GRoute, center: LatLng): Candidate | null {
  const enc = route.polyline?.encodedPolyline;
  const seconds = parseDuration(route.duration);
  if (!enc || seconds == null) return null;
  const path = decodePolyline(enc);
  return { route, path, seconds, staticSeconds: parseDuration(route.staticDuration) ?? seconds, minDist: distanceToPath(center, path) };
}

function steps(route: GRoute): RouteStep[] {
  return (route.legs ?? [])
    .flatMap((l) => l.steps ?? [])
    .filter((s) => s.navigationInstruction?.instructions)
    .slice(0, 40)
    .map((s) => ({
      instruction: s.navigationInstruction!.instructions!,
      distanceM: s.distanceMeters ?? 0,
      maneuver: s.navigationInstruction?.maneuver ?? null,
    }));
}

/**
 * Real Google detour around an incident: compares the fastest route that passes the incident
 * (plus the reported delay) with the fastest route that keeps clear of it. At most 4 Google calls.
 */
export async function googleDetour(opts: {
  center: LatLng;
  start: LatLng;
  end: LatLng;
  roadBearing: number;
  reportedDelayMin: number;
}): Promise<SuggestedRoute> {
  const { center, start, end } = opts;
  const first = (await computeRoutes({ origin: start, destination: end, alternatives: true, fieldMask: FIELD_MASK }))
    .map((r) => toCandidate(r, center))
    .filter((c): c is Candidate => !!c);

  const byTime = (a: Candidate, b: Candidate) => a.seconds - b.seconds;
  let through = first.filter((c) => c.minDist < THROUGH_M).sort(byTime)[0];
  let avoid = first.filter((c) => c.minDist >= AVOID_M).sort(byTime)[0];

  if (!through) {
    const [r] = await computeRoutes({ origin: start, destination: end, via: [center], fieldMask: FIELD_MASK });
    through = r ? (toCandidate(r, center) ?? undefined) : undefined;
  }
  if (!avoid) {
    for (const side of [90, -90]) {
      const via = offset(center, 900, opts.roadBearing + side);
      const [r] = await computeRoutes({ origin: start, destination: end, via: [via], fieldMask: FIELD_MASK });
      const c = r ? toCandidate(r, center) : null;
      if (c && c.minDist >= AVOID_M) {
        avoid = c;
        break;
      }
    }
  }
  if (!avoid) throw new Error("Google couldn't find a road that avoids this incident");

  const directMinutes = (through ? through.seconds / 60 : haversine(start, end) / 367) + opts.reportedDelayMin;
  const altMinutes = avoid.seconds / 60;
  return {
    path: avoid.path,
    throughPath: through?.path,
    start,
    end,
    distanceKm: (avoid.route.distanceMeters ?? 0) / 1000,
    altMinutes,
    directMinutes,
    usualMinutes: avoid.staticSeconds / 60,
    timeSavedMinutes: Math.round(directMinutes - altMinutes),
    steps: steps(avoid.route),
    source: "google",
  };
}
