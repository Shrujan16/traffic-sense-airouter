import { CarFront, HardHat, OctagonX, Wrench, type LucideIcon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import type { ComponentType, SVGProps } from "react";

import { TrafficLightIcon } from "@/components/incidents/TrafficLightIcon";
import type { Database } from "@/integrations/supabase/types";

export type Incident = Database["public"]["Tables"]["incidents"]["Row"];
export type IncidentType = "accident" | "breakdown" | "construction" | "signal_failure" | "roadblock";
export type Severity = "low" | "medium" | "high";
export type VoteType = "still_there" | "cleared" | "upvote";

export const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

export interface IncidentTypeMeta {
  value: IncidentType;
  label: string;
  icon: IconComponent;
  /** Tailwind classes using design tokens */
  bg: string;
  text: string;
  soft: string;
  cssVar: string;
  blurb: string;
}

export const INCIDENT_TYPES: IncidentTypeMeta[] = [
  {
    value: "accident",
    label: "Accident",
    icon: CarFront,
    bg: "bg-inc-accident",
    text: "text-inc-accident",
    soft: "bg-inc-accident/12 text-inc-accident border-inc-accident/30",
    cssVar: "var(--inc-accident)",
    blurb: "Collisions block lanes and onlookers slow everyone down.",
  },
  {
    value: "breakdown",
    label: "Breakdown",
    icon: Wrench,
    bg: "bg-inc-breakdown",
    text: "text-inc-breakdown",
    soft: "bg-inc-breakdown/12 text-inc-breakdown border-inc-breakdown/30",
    cssVar: "var(--inc-breakdown)",
    blurb: "A stalled bus or truck can choke a busy lane in minutes.",
  },
  {
    value: "construction",
    label: "Construction",
    icon: HardHat,
    bg: "bg-inc-construction",
    text: "text-inc-construction",
    soft: "bg-inc-construction/15 text-inc-construction border-inc-construction/40",
    cssVar: "var(--inc-construction)",
    blurb: "Metro and road works narrow the road for weeks at a time.",
  },
  {
    value: "signal_failure",
    label: "Signal Failure",
    icon: TrafficLightIcon,
    bg: "bg-inc-signal",
    text: "text-inc-signal",
    soft: "bg-inc-signal/12 text-inc-signal border-inc-signal/30",
    cssVar: "var(--inc-signal)",
    blurb: "Dead signals turn busy junctions into gridlock.",
  },
  {
    value: "roadblock",
    label: "Roadblock",
    icon: OctagonX,
    bg: "bg-inc-roadblock",
    text: "text-inc-roadblock",
    soft: "bg-inc-roadblock/12 text-inc-roadblock border-inc-roadblock/30",
    cssVar: "var(--inc-roadblock)",
    blurb: "Barricades, processions and closures divert whole corridors.",
  },
];

export const TYPE_META: Record<IncidentType, IncidentTypeMeta> = Object.fromEntries(
  INCIDENT_TYPES.map((t) => [t.value, t]),
) as Record<IncidentType, IncidentTypeMeta>;

export const SEVERITY_META: Record<Severity, { label: string; soft: string; dot: string; rank: number }> = {
  low: { label: "Low", soft: "bg-sev-low/12 text-sev-low border-sev-low/30", dot: "bg-sev-low", rank: 1 },
  medium: { label: "Medium", soft: "bg-sev-medium/15 text-sev-medium border-sev-medium/40", dot: "bg-sev-medium", rank: 2 },
  high: { label: "High", soft: "bg-sev-high/12 text-sev-high border-sev-high/30", dot: "bg-sev-high", rank: 3 },
};

export function typeMeta(type: string): IncidentTypeMeta {
  return TYPE_META[type as IncidentType] ?? TYPE_META.roadblock;
}
export function severityMeta(sev: string) {
  return SEVERITY_META[sev as Severity] ?? SEVERITY_META.medium;
}

export function timeAgo(iso: string) {
  try {
    return `${formatDistanceToNowStrict(new Date(iso))} ago`;
  } catch {
    return "";
  }
}

export function formatMinutes(min: number) {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export interface IncidentAnalysis {
  likely_cause: string;
  explanation: string;
  severity: Severity;
  estimated_delay_minutes: number;
  estimated_clearance_minutes: number;
  advice: string;
}

/** Base delay / clearance minutes per type at medium severity. */
const BASE: Record<IncidentType, { delay: number; clearance: number; cause: string; why: string; advice: string }> = {
  accident: {
    delay: 20,
    clearance: 45,
    cause: "Road accident blocking traffic",
    why: "An accident has blocked part of the road, so vehicles have to squeeze past while the scene is cleared. Drivers slowing down to look make the queue longer.",
    advice: "Use a parallel road if you can, or expect slow movement until the vehicles are moved.",
  },
  breakdown: {
    delay: 12,
    clearance: 35,
    cause: "Broken-down vehicle in a lane",
    why: "A vehicle has broken down and is occupying a lane. Traffic has to merge around it, which causes a slow crawl behind it.",
    advice: "Keep to the free lane early and expect a short delay until a tow arrives.",
  },
  construction: {
    delay: 15,
    clearance: 240,
    cause: "Road works narrowing the road",
    why: "Construction work has narrowed the road, so more vehicles are sharing fewer lanes. The slowdown is worst during peak hours.",
    advice: "Leave earlier or take an alternate route; this work may last several hours.",
  },
  signal_failure: {
    delay: 18,
    clearance: 50,
    cause: "Traffic signal not working",
    why: "The traffic signal is not working, so vehicles from different directions are crossing at the same time. Without control, the junction locks up and queues build in every direction.",
    advice: "Avoid the junction if possible until police or a repair crew restores control.",
  },
  roadblock: {
    delay: 20,
    clearance: 60,
    cause: "Road closed or barricaded",
    why: "Part of the road is closed or barricaded, so traffic is being diverted onto nearby roads that cannot handle the extra volume.",
    advice: "Follow diversions early or choose a different corridor until the closure lifts.",
  },
};

const SEVERITY_FACTOR: Record<Severity, number> = { low: 0.5, medium: 1, high: 1.7 };

/** Rule-based estimate used when the AI service is unavailable. */
export function ruleBasedEstimate(
  type: IncidentType,
  severity: Severity,
  description = "",
  location = "this location",
): IncidentAnalysis {
  const base = BASE[type] ?? BASE.roadblock;
  const f = SEVERITY_FACTOR[severity] ?? 1;
  const d = description.toLowerCase();
  let delay = base.delay * f;
  // Peak-hour and lane-blocking keywords increase the impact
  if (/(all lanes|completely|fully blocked|both sides|jam)/.test(d)) delay *= 1.3;
  if (/(cleared|moved aside|moved to the side|minor)/.test(d)) delay *= 0.6;
  const clearance = type === "construction" ? base.clearance : base.clearance * f;
  return {
    likely_cause: base.cause,
    explanation: `${base.why} This is near ${location}.`,
    severity,
    estimated_delay_minutes: Math.max(1, Math.round(delay)),
    estimated_clearance_minutes: Math.max(5, Math.round(clearance)),
    advice: base.advice,
  };
}
