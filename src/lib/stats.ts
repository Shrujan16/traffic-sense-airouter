import { startOfDay, subDays, format } from "date-fns";

import { INCIDENT_TYPES, typeMeta, type Incident } from "./incidents";

export function computeStats(incidents: Incident[], now = new Date()) {
  const today = startOfDay(now).getTime();
  const active = incidents.filter((i) => i.status === "active");
  const reportsToday = incidents.filter((i) => new Date(i.created_at).getTime() >= today).length;
  const avgDelay = active.length ? Math.round(active.reduce((s, i) => s + i.estimated_delay, 0) / active.length) : 0;
  const counts = new Map<string, number>();
  for (const i of incidents) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const resolvedToday = incidents.filter((i) => i.status === "cleared" && new Date(i.updated_at).getTime() >= today).length;
  const areaCounts = new Map<string, { count: number; delay: number }>();
  for (const i of incidents) {
    const a = areaCounts.get(i.location_name) ?? { count: 0, delay: 0 };
    a.count += 1;
    a.delay += i.estimated_delay;
    areaCounts.set(i.location_name, a);
  }
  const hotspots = [...areaCounts.entries()]
    .map(([name, v]) => ({ name, count: v.count, totalDelay: v.delay }))
    .sort((a, b) => b.totalDelay - a.totalDelay || b.count - a.count)
    .slice(0, 5);
  return {
    total: incidents.length,
    active: active.length,
    reportsToday,
    avgDelay,
    mostCommon: top ? typeMeta(top[0]).label : "—",
    resolvedToday,
    hotspots,
    mostAffected: hotspots[0]?.name ?? "—",
  };
}

export function byType(incidents: Incident[]) {
  return INCIDENT_TYPES.map((t) => ({
    name: t.label,
    value: incidents.filter((i) => i.type === t.value).length,
    color: t.cssVar,
  })).filter((d) => d.value > 0);
}

export function byHour(incidents: Incident[]) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}`.padStart(2, "0"), count: 0 }));
  for (const i of incidents) buckets[new Date(i.created_at).getHours()]!.count += 1;
  return buckets;
}

export function last7Days(incidents: Incident[], now = new Date()) {
  return Array.from({ length: 7 }, (_, idx) => {
    const day = startOfDay(subDays(now, 6 - idx));
    const next = day.getTime() + 86_400_000;
    return {
      label: format(day, "EEE"),
      count: incidents.filter((i) => {
        const t = new Date(i.created_at).getTime();
        return t >= day.getTime() && t < next;
      }).length,
    };
  });
}
