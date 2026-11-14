import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

import { INCIDENT_TYPES } from "@/lib/incidents";
import { cn } from "@/lib/utils";

export function MapLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("rounded-xl border border-border glass p-3 text-xs shadow-elevated", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 font-semibold text-foreground"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Legend</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {INCIDENT_TYPES.map((t) => (
            <li key={t.value} className="flex items-center gap-2 text-muted-foreground">
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-navy-foreground", t.bg)}>
                <t.icon className="h-3 w-3" size={12} />
              </span>
              {t.label}
            </li>
          ))}
          <li className="flex items-center gap-2 border-t border-border pt-1.5 text-muted-foreground">
            <span className="relative grid h-5 w-5 place-items-center">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-sev-high" />
              <span className="h-2.5 w-2.5 rounded-full bg-sev-high" />
            </span>
            High severity
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span className="h-1 w-5 rounded-full bg-teal" /> Suggested route
          </li>
        </ul>
      )}
    </div>
  );
}
