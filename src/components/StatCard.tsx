import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  loading,
  tone = "teal",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  tone?: "teal" | "warning" | "danger" | "success";
  className?: string;
}) {
  const toneClass = {
    teal: "bg-teal/12 text-teal",
    warning: "bg-warning/15 text-warning",
    danger: "bg-sev-high/12 text-sev-high",
    success: "bg-success/12 text-success",
  }[tone];
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", toneClass)} aria-hidden>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 truncate text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
      )}
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
