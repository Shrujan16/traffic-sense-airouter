import { useEffect, useRef } from "react";
import { Clock, MapPinOff, X } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { TypeIconBubble } from "@/components/incidents/Badges";
import { formatMinutes, severityMeta, SEVERITY_META, timeAgo, typeMeta, type Incident, type Severity } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export type SortMode = "newest" | "severity";

export function sortIncidents(items: Incident[], mode: SortMode) {
  const copy = [...items];
  if (mode === "severity") {
    copy.sort(
      (a, b) =>
        (SEVERITY_META[b.severity as Severity]?.rank ?? 0) - (SEVERITY_META[a.severity as Severity]?.rank ?? 0) ||
        +new Date(b.created_at) - +new Date(a.created_at),
    );
  } else copy.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return copy;
}

export function IncidentList({
  incidents,
  loading,
  selectedId,
  onSelect,
  sort,
  onSortChange,
  onClose,
}: {
  incidents: Incident[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: SortMode;
  onSortChange: (s: SortMode) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <section aria-label="Incident list" className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-elevated">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Incidents</h2>
          <p className="text-xs text-muted-foreground">{incidents.length} matching</p>
        </div>
        <div className="flex items-center gap-1">
          <div role="radiogroup" aria-label="Sort incidents" className="flex rounded-full bg-muted p-0.5 text-xs">
            {(["newest", "severity"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={sort === m}
                onClick={() => onSortChange(m)}
                className={cn("rounded-full px-2.5 py-1 font-medium capitalize", sort === m ? "bg-card text-foreground shadow-soft" : "text-muted-foreground")}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close list" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <ul ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-2">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </li>
          ))}
        {!loading && incidents.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <MapPinOff className="h-8 w-8" />
            No incidents match these filters.
          </li>
        )}
        {incidents.map((inc) => {
          const sev = severityMeta(inc.severity);
          return (
            <li key={inc.id} data-id={inc.id}>
              <button
                type="button"
                onClick={() => onSelect(inc.id)}
                aria-current={inc.id === selectedId}
                className={cn(
                  "flex w-full gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted",
                  inc.id === selectedId && "bg-teal/10 ring-1 ring-teal/40",
                  inc.status === "cleared" && "opacity-60",
                )}
              >
                <TypeIconBubble type={inc.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", sev.dot)} aria-label={`${sev.label} severity`} />
                    <span className="truncate text-sm font-semibold">{inc.location_name}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {typeMeta(inc.type).label} · +{formatMinutes(inc.estimated_delay)} delay
                    {inc.status === "cleared" ? " · Cleared" : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {timeAgo(inc.created_at)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
