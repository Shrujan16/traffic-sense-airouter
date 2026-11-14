import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2 font-semibold tracking-tight" aria-label="TrafficSense AI home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-teal text-teal-foreground shadow-glow transition-transform group-hover:scale-105">
        <Activity className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className={inverted ? "text-navy-foreground" : "text-foreground"}>
        TrafficSense <span className="text-teal">AI</span>
      </span>
    </Link>
  );
}
