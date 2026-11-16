import { CORRIDORS, TRAFFIC_REFRESH_SECONDS } from "@/lib/traffic";
import { computeRoutes, parseDuration } from "./maps.server";

const FIELD_MASK =
  "routes.duration,routes.staticDuration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals";

/**
 * Refreshes live traffic for every corridor when the cache is older than 15 minutes.
 * A database lock makes sure only one request does this, however many people are viewing.
 */
export async function refreshCorridorsIfStale(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed, error } = await supabaseAdmin.rpc("claim_traffic_refresh", { _max_age_seconds: TRAFFIC_REFRESH_SECONDS });
  if (error) {
    console.error("Traffic refresh lock failed", error);
    return false;
  }
  if (!claimed) return false;

  const results = await Promise.allSettled(
    CORRIDORS.map(async (c) => {
      const [route] = await computeRoutes({ origin: c.origin, destination: c.destination, trafficOnPolyline: true, fieldMask: FIELD_MASK });
      if (!route?.polyline?.encodedPolyline) throw new Error(`No route for ${c.id}`);
      const duration = parseDuration(route.duration);
      const usual = parseDuration(route.staticDuration);
      if (duration == null || usual == null) throw new Error(`Missing duration for ${c.id}`);
      return {
        id: c.id,
        name: c.name,
        encoded_polyline: route.polyline.encodedPolyline,
        distance_m: route.distanceMeters ?? 0,
        duration_s: Math.round(duration),
        static_duration_s: Math.round(usual),
        speed_intervals: (route.travelAdvisory?.speedReadingIntervals ?? []) as never,
        updated_at: new Date().toISOString(),
      };
    }),
  );
  const rows = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  results.forEach((r) => r.status === "rejected" && console.error("Corridor refresh failed", r.reason));
  if (rows.length) {
    const { error: upsertError } = await supabaseAdmin.from("traffic_corridors").upsert(rows);
    if (upsertError) console.error("Saving live traffic failed", upsertError);
  }
  return rows.length > 0;
}
