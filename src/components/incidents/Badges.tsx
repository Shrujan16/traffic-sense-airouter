import { cn } from "@/lib/utils";
import { severityMeta, typeMeta } from "@/lib/incidents";

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const m = typeMeta(type);
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", m.soft, className)}>
      <Icon className="h-3.5 w-3.5" size={14} />
      {m.label}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const m = severityMeta(severity);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", m.soft, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label} severity
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cleared = status === "cleared";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        cleared ? "border-success/30 bg-success/12 text-success" : "border-teal/30 bg-teal/12 text-teal",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cleared ? "bg-success" : "animate-pulse bg-teal")} aria-hidden />
      {cleared ? "Cleared" : "Active"}
    </span>
  );
}

export function TypeIconBubble({ type, className }: { type: string; className?: string }) {
  const m = typeMeta(type);
  const Icon = m.icon;
  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", m.bg, "text-navy-foreground", className)} aria-hidden>
      <Icon className="h-5 w-5" size={20} />
    </span>
  );
}
