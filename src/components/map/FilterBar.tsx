import { Search, X } from "lucide-react";
import type { FormEvent } from "react";

import { INCIDENT_TYPES, type IncidentType, type Severity } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export type TimeWindow = "1h" | "6h" | "24h" | "all";
export interface MapFilters {
  types: IncidentType[];
  severity: Severity | "all";
  time: TimeWindow;
  search: string;
}

export const DEFAULT_FILTERS: MapFilters = { types: [], severity: "all", time: "all", search: "" };

export const TIME_WINDOWS: { value: TimeWindow; label: string; hours: number | null }[] = [
  { value: "1h", label: "1h", hours: 1 },
  { value: "6h", label: "6h", hours: 6 },
  { value: "24h", label: "24h", hours: 24 },
  { value: "all", label: "All", hours: null },
];

const SEVERITIES: { value: Severity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 items-center rounded-full border border-border bg-card p-0.5 shadow-soft">
      <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  onSearchSubmit,
  resultCount,
}: {
  filters: MapFilters;
  onChange: (f: MapFilters) => void;
  onSearchSubmit?: (q: string) => void;
  resultCount: number;
}) {
  const toggleType = (t: IncidentType) =>
    onChange({ ...filters, types: filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(filters.search.trim());
  };

  return (
    <div className="space-y-2">
      <form onSubmit={submit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search area or road (e.g. Silk Board, ORR)…"
          aria-label="Search area or road name"
          className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-24 text-sm shadow-elevated outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/30"
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-muted-foreground">
          <span aria-live="polite">{resultCount} shown</span>
          {filters.search && (
            <button type="button" aria-label="Clear search" onClick={() => onChange({ ...filters, search: "" })} className="rounded-full p-1 hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </form>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {INCIDENT_TYPES.map((t) => {
          const active = filters.types.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(t.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-soft transition-all",
                active ? cn(t.bg, "border-transparent text-navy-foreground") : "border-border bg-card text-foreground hover:border-foreground/30",
              )}
            >
              <t.icon className={cn("h-3.5 w-3.5", !active && t.text)} size={14} />
              {t.label}
            </button>
          );
        })}
        <Segmented label="Severity" value={filters.severity} options={SEVERITIES} onChange={(v) => onChange({ ...filters, severity: v })} />
        <Segmented label="Time" value={filters.time} options={TIME_WINDOWS} onChange={(v) => onChange({ ...filters, time: v })} />
      </div>
    </div>
  );
}

export function applyFilters<T extends { type: string; severity: string; created_at: string; location_name: string; description: string }>(
  items: T[],
  f: MapFilters,
  now = Date.now(),
): T[] {
  const hours = TIME_WINDOWS.find((t) => t.value === f.time)?.hours ?? null;
  const q = f.search.trim().toLowerCase();
  return items.filter((i) => {
    if (f.types.length && !f.types.includes(i.type as IncidentType)) return false;
    if (f.severity !== "all" && i.severity !== f.severity) return false;
    if (hours !== null && now - new Date(i.created_at).getTime() > hours * 3_600_000) return false;
    if (q && !`${i.location_name} ${i.description}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
