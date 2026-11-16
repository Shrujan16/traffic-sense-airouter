import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bearing, decodePolyline, haversine, hashBearing, nearestSegmentBearing, offset, type LatLng, type SuggestedRoute } from "./geo";
import { googleDetour } from "./google/directions.server";

const input = z.object({
  incidentId: z.string().uuid(),
  from: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
});

/** Google directions around an incident. Signed-in users only, to keep Google usage bounded. */
export const getAlternateRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<SuggestedRoute> => {
    const { data: incident, error } = await context.supabase
      .from("incidents")
      .select("id, lat, lng, status, estimated_delay")
      .eq("id", data.incidentId)
      .single();
    if (error || !incident) throw new Error("Incident not found");
    const center: LatLng = [incident.lat, incident.lng];

    // Direction of the road the incident is on, from the nearest tracked corridor.
    const { data: corridors } = await context.supabase.from("traffic_corridors").select("encoded_polyline");
    let roadBearing = hashBearing(incident.id);
    let bestDist = Infinity;
    for (const c of corridors ?? []) {
      const hit = c.encoded_polyline ? nearestSegmentBearing(center, decodePolyline(c.encoded_polyline), 300) : null;
      if (hit && hit.distance < bestDist) {
        bestDist = hit.distance;
        roadBearing = hit.bearing;
      }
    }

    let start: LatLng;
    let end: LatLng;
    const from: LatLng | null = data.from ? [data.from.lat, data.from.lng] : null;
    const fromDist = from ? haversine(from, center) : 0;
    if (from && fromDist > 800 && fromDist < 15_000) {
      // Commuter heading through the incident: from their location to a point beyond it.
      start = from;
      end = offset(center, 1500, bearing(from, center));
    } else {
      start = offset(center, 1500, roadBearing + 180);
      end = offset(center, 1500, roadBearing);
    }

    try {
      return await googleDetour({
        center,
        start,
        end,
        roadBearing,
        reportedDelayMin: incident.status === "active" ? Math.max(0, incident.estimated_delay) : 0,
      });
    } catch (e) {
      console.error("Google detour failed", e);
      throw new Error(e instanceof Error ? e.message : "Couldn't get directions right now");
    }
  });
