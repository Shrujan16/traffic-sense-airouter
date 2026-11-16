import { haversine } from "./geo";

export interface PastReport {
  id: string;
  type: string;
  lat: number;
  lng: number;
  status: string;
  created_at: string;
  cleared_at: string | null;
  still_there_count: number;
  cleared_count: number;
  upvotes: number;
  image_url: string | null;
}

/** Max confirmed reports given to the AI as examples. */
export const MAX_REFERENCES = 5;

/** A report is community-confirmed when it was voted cleared, or at least 2 people confirmed or upvoted it. */
export function isConfirmed(r: Pick<PastReport, "status" | "cleared_at" | "still_there_count" | "upvotes">) {
  return (r.status === "cleared" && r.cleared_at != null) || r.still_there_count >= 2 || r.upvotes >= 2;
}

/** Real minutes from report to community clearance, or null if not cleared. */
export function actualClearanceMinutes(r: Pick<PastReport, "created_at" | "cleared_at">) {
  if (!r.cleared_at) return null;
  const m = (new Date(r.cleared_at).getTime() - new Date(r.created_at).getTime()) / 60_000;
  return m > 0 ? Math.round(m) : null;
}

/**
 * Picks the most relevant confirmed reports for a new one: same type matters most,
 * then closeness, then having a real clearance time or photo.
 */
export function pickReferences<T extends PastReport>(pool: T[], target: { id?: string; type: string; lat: number; lng: number }, limit = MAX_REFERENCES) {
  return pool
    .filter((r) => r.id !== target.id && isConfirmed(r))
    .map((r) => {
      const km = haversine([target.lat, target.lng], [r.lat, r.lng]) / 1000;
      const sameType = r.type === target.type;
      let score = sameType ? 3 : 0;
      if (km < 2) score += 2;
      else if (km < 5) score += 1;
      if (r.cleared_at) score += 1;
      if (r.image_url) score += 0.5;
      return { report: r, km, score, sameType };
    })
    .filter((x) => x.sameType || x.km < 2)
    .sort((a, b) => b.score - a.score || a.km - b.km)
    .slice(0, limit);
}
