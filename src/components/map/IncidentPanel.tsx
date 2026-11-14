import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  Lightbulb,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Share2,
  Sparkles,
  ThumbsUp,
  Timer,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge, StatusBadge, TypeBadge } from "@/components/incidents/Badges";
import { useAuth } from "@/hooks/use-auth";
import { incidentsQuery, useSignedImage } from "@/hooks/use-incidents";
import { supabase } from "@/integrations/supabase/client";
import type { SuggestedRoute } from "@/lib/geo";
import { formatMinutes, timeAgo, type Incident, type VoteType } from "@/lib/incidents";
import { cn } from "@/lib/utils";

interface Props {
  incident: Incident;
  onClose: () => void;
  route: SuggestedRoute | null;
  routeLoading: boolean;
  onSuggestRoute: () => void;
  onClearRoute: () => void;
}

export function IncidentPanel({ incident, onClose, route, routeLoading, onSuggestRoute, onClearRoute }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState(false);
  const image = useSignedImage(incident.image_url);

  const myVotes = useQuery({
    queryKey: ["my-votes", incident.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incident_votes")
        .select("vote_type")
        .eq("incident_id", incident.id)
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((v) => v.vote_type as VoteType));
    },
  });

  const vote = useMutation({
    mutationFn: async (type: VoteType) => {
      const { data, error } = await supabase.rpc("cast_vote", { _incident_id: incident.id, _vote_type: type });
      if (error) throw new Error(error.message);
      const { data: fresh } = await supabase.from("incidents").select("*").eq("id", incident.id).single();
      return { result: data, fresh };
    },
    onSuccess: ({ result, fresh }, type) => {
      if (fresh) {
        queryClient.setQueryData<Incident[]>(incidentsQuery.queryKey, (prev = []) => prev.map((p) => (p.id === fresh.id ? fresh : p)));
      }
      void myVotes.refetch();
      const label = type === "upvote" ? "Upvote" : type === "cleared" ? "Marked as cleared" : "Confirmed still there";
      toast.success(result === "removed" ? "Vote removed" : label);
    },
    onError: (e: Error) => toast.error(e.message || "Could not record your vote"),
  });

  function requireLogin(action: () => void) {
    if (!user) {
      toast("Sign in to confirm incidents", {
        description: "Browsing is free — confirming and reporting need an account.",
        action: { label: "Log in", onClick: () => navigate({ to: "/login" }) },
      });
      return;
    }
    action();
  }

  async function share() {
    const url = `${window.location.origin}/map?incident=${incident.id}`;
    const text = `Traffic at ${incident.location_name}: ${incident.ai_likely_cause ?? ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "TrafficSense AI", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      /* user cancelled */
    }
  }

  const voted = myVotes.data ?? new Set<VoteType>();
  const pending = vote.isPending ? vote.variables : null;

  return (
    <article aria-labelledby="incident-title" className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <TypeBadge type={incident.type} />
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <h2 id="incident-title" className="text-lg font-bold leading-tight">{incident.location_name}</h2>
          <p className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Reported {timeAgo(incident.created_at)}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close incident details" className="hidden rounded-full p-1.5 text-muted-foreground hover:bg-muted md:block">
          <X className="h-5 w-5" />
        </button>
      </header>

      <section className="rounded-xl border border-teal/30 bg-teal/8 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-teal" /> Why is there traffic here?
        </h3>
        {incident.ai_likely_cause && <p className="mt-2 text-sm font-semibold text-teal">{incident.ai_likely_cause}</p>}
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">
          {incident.ai_explanation ?? "AI analysis is being prepared for this report…"}
        </p>
        {incident.ai_advice && (
          <p className="mt-3 flex gap-2 rounded-lg bg-card/70 p-2.5 text-xs text-foreground/80">
            <Lightbulb className="h-4 w-4 shrink-0 text-warning" /> {incident.ai_advice}
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Estimated delay</p>
          <p className="mt-1 text-xl font-bold text-sev-high">+{formatMinutes(incident.estimated_delay)}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hourglass className="h-3.5 w-3.5" /> Est. clearance</p>
          <p className="mt-1 text-xl font-bold">{formatMinutes(incident.estimated_clearance)}</p>
        </div>
      </div>

      {incident.description && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reporter's note</h3>
          <p className="mt-1 text-sm">{incident.description}</p>
        </section>
      )}

      {incident.image_url && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photo</h3>
          {image.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : image.data ? (
            <>
              <button type="button" onClick={() => setLightbox(true)} className="group block w-full overflow-hidden rounded-xl" aria-label="Open photo full size">
                <img src={image.data} alt={`Photo of the incident at ${incident.location_name}`} loading="lazy" className="h-44 w-full object-cover transition-transform group-hover:scale-105" />
              </button>
              <Dialog open={lightbox} onOpenChange={setLightbox}>
                <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
                  <DialogTitle className="sr-only">Incident photo</DialogTitle>
                  <img src={image.data} alt={`Photo of the incident at ${incident.location_name}`} className="max-h-[85vh] w-full rounded-xl object-contain" />
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Photo unavailable.</p>
          )}
        </section>
      )}

      <section aria-label="Community confirmations">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Is it still there?</h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { type: "still_there", label: "Still there", icon: Eye, count: incident.still_there_count, active: "border-warning bg-warning/15 text-warning" },
              { type: "cleared", label: "Cleared", icon: CheckCircle2, count: incident.cleared_count, active: "border-success bg-success/15 text-success" },
              { type: "upvote", label: "Upvote", icon: ThumbsUp, count: incident.upvotes, active: "border-teal bg-teal/15 text-teal" },
            ] as const
          ).map((b) => {
            const on = voted.has(b.type);
            return (
              <button
                key={b.type}
                type="button"
                aria-pressed={on}
                disabled={vote.isPending}
                onClick={() => requireLogin(() => vote.mutate(b.type))}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-2.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-60",
                  on && b.active,
                )}
              >
                {pending === b.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <b.icon className="h-4 w-4" />}
                {b.label}
                <span className="text-sm font-bold">{b.count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        {route ? (
          <div className="rounded-xl border border-teal/40 bg-teal/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold"><RouteIcon className="h-4 w-4 text-teal" /> Suggested route</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-bold">{route.distanceKm.toFixed(1)} km</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time saved</p>
                <p className="font-bold text-teal">
                  {route.timeSavedMinutes > 0 ? `~${route.timeSavedMinutes} min` : "Similar time"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {route.source === "road" ? "Detour planned on real roads around this incident." : "Approximate detour (road routing unavailable)."} Suggested only — follow local signage.
            </p>
            <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={onClearRoute}>Hide route</Button>
          </div>
        ) : (
          <Button variant="teal" className="w-full" onClick={onSuggestRoute} disabled={routeLoading}>
            {routeLoading ? <Loader2 className="animate-spin" /> : <RouteIcon />}
            Suggest alternative route
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={share}><Share2 /> Share</Button>
          <Button asChild variant="outline"><Link to="/report">Report nearby</Link></Button>
        </div>
      </section>
    </article>
  );
}
