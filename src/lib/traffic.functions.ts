import { createServerFn } from "@tanstack/react-start";

import { refreshCorridorsIfStale } from "./google/traffic.server";
import { createPublicClient } from "./supabase-public.server";
import { TRAFFIC_REFRESH_SECONDS, type CorridorRow } from "./traffic";

/** Live congestion on main Bengaluru roads. Google is called at most once per 15 minutes. */
export const getLiveTraffic = createServerFn({ method: "GET" }).handler(async (): Promise<{ corridors: CorridorRow[] }> => {
  const db = createPublicClient();
  const read = async () => {
    const { data, error } = await db.from("traffic_corridors").select("*").order("name");
    if (error) throw new Error("Live traffic is unavailable right now");
    return data as CorridorRow[];
  };
  let rows = await read();
  const newest = rows.reduce((m, r) => Math.max(m, new Date(r.updated_at).getTime()), 0);
  if (!rows.length || Date.now() - newest > TRAFFIC_REFRESH_SECONDS * 1000) {
    try {
      if (await refreshCorridorsIfStale()) rows = await read();
    } catch (e) {
      console.error("Live traffic refresh failed", e);
    }
  }
  return { corridors: rows };
});
