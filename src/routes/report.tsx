import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Hourglass, Lightbulb, LogIn, MapPinned, PlusCircle, Sparkles, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge, TypeBadge } from "@/components/incidents/Badges";
import { ReportForm, type ReportSuccess } from "@/components/report/ReportForm";
import { useAuth } from "@/hooks/use-auth";
import { formatMinutes } from "@/lib/incidents";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Traffic Incident | TrafficSense AI" },
      { name: "description", content: "Report an accident, breakdown, construction, signal failure or roadblock. Our AI explains the cause and impact for every commuter." },
      { property: "og:title", content: "Report a Traffic Incident | TrafficSense AI" },
      { property: "og:description", content: "Help your city move — report what's causing the traffic in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { user, loading } = useAuth();
  const [success, setSuccess] = useState<ReportSuccess | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {!success && (
        <header className="mb-8 animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal">Report incident</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">What's slowing traffic?</h1>
          <p className="mt-2 text-muted-foreground">Your report appears on the live map instantly. Our AI then explains the likely cause and impact for everyone nearby.</p>
        </header>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : !user ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-soft">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal/12 text-teal"><LogIn className="h-6 w-6" /></span>
          <h2 className="mt-4 text-xl font-semibold">Sign in to report an incident</h2>
          <p className="mt-2 text-sm text-muted-foreground">Accounts keep reports trustworthy. Browsing the live map is always free.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="teal"><Link to="/login">Log in</Link></Button>
            <Button asChild variant="outline"><Link to="/signup">Create account</Link></Button>
          </div>
        </div>
      ) : success ? (
        <SuccessView result={success} onAnother={() => setSuccess(null)} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 shadow-soft sm:p-8">
          <ReportForm
            onSuccess={(r) => {
              setSuccess(r);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}

function SuccessView({ result, onAnother }: { result: ReportSuccess; onAnother: () => void }) {
  const inc = result.incident;
  return (
    <div className="animate-fade-up space-y-6">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-8 w-8" /></span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Thanks — your report is live</h1>
        <p className="mt-2 text-muted-foreground">Commuters near {inc.location_name} can now see what's happening.</p>
      </div>
      <div className="rounded-xl border border-teal/30 bg-card p-6 shadow-elevated">
        <div className="flex flex-wrap gap-1.5">
          <TypeBadge type={inc.type} />
          <SeverityBadge severity={inc.severity} />
        </div>
        <h2 className="mt-4 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-teal" /> Why is there traffic here?</h2>
        <p className="mt-1 font-semibold text-teal">{inc.ai_likely_cause}</p>
        <p className="mt-2 leading-relaxed">{inc.ai_explanation}</p>
        {inc.ai_advice && (
          <p className="mt-4 flex gap-2 rounded-lg bg-muted p-3 text-sm"><Lightbulb className="h-4 w-4 shrink-0 text-warning" /> {inc.ai_advice}</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Estimated delay</p>
            <p className="text-xl font-bold text-sev-high">+{formatMinutes(inc.estimated_delay)}</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hourglass className="h-3.5 w-3.5" /> Est. clearance</p>
            <p className="text-xl font-bold">{formatMinutes(inc.estimated_clearance)}</p>
          </div>
        </div>
        {result.analysisSource === "fallback" && (
          <p className="mt-3 text-xs text-muted-foreground">AI analysis was unavailable, so this is a rule-based estimate.</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="teal" size="lg" className="flex-1">
          <Link to="/map" search={{ incident: inc.id }}><MapPinned /> View on map</Link>
        </Button>
        <Button variant="outline" size="lg" className="flex-1" onClick={onAnother}><PlusCircle /> Report another</Button>
      </div>
    </div>
  );
}
