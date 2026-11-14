import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileX2, Loader2, MapPinned, PlusCircle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SeverityBadge, StatusBadge, TypeIconBubble } from "@/components/incidents/Badges";
import { useAuth } from "@/hooks/use-auth";
import { incidentsQuery } from "@/hooks/use-incidents";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, typeMeta, type Incident } from "@/lib/incidents";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My reports | TrafficSense AI" },
      { name: "description", content: "Your TrafficSense AI profile and the incidents you've reported." },
      { property: "og:title", content: "My reports | TrafficSense AI" },
      { property: "og:description", content: "Your profile and reported incidents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const profile = useQuery({
    queryKey: ["my-reports", "profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  useEffect(() => {
    if (profile.data?.display_name) setName(profile.data.display_name);
  }, [profile.data?.display_name]);

  const reports = useQuery({
    queryKey: ["my-reports", "list", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Incident[]> => {
      const { data, error } = await supabase.from("incidents").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const saveName = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2 || trimmed.length > 60) throw new Error("Display name must be 2–60 characters");
      const { error } = await supabase.from("profiles").upsert({ id: user!.id, display_name: trimmed });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profile saved");
      void profile.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (inc: Incident) => {
      const { error } = await supabase.from("incidents").delete().eq("id", inc.id);
      if (error) throw new Error(error.message);
      if (inc.image_url && !/^https?:/.test(inc.image_url)) await supabase.storage.from("incident-images").remove([inc.image_url]);
      return inc.id;
    },
    onSuccess: (id) => {
      toast.success("Report deleted");
      queryClient.setQueryData<Incident[]>(incidentsQuery.queryKey, (prev) => prev?.filter((p) => p.id !== id));
      void reports.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markCleared = useMutation({
    mutationFn: async (inc: Incident) => {
      const { error } = await supabase.from("incidents").update({ status: inc.status === "active" ? "cleared" : "active" }).eq("id", inc.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void reports.refetch();
      void queryClient.invalidateQueries({ queryKey: incidentsQuery.queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal">Profile</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">My reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </header>

      <section className="mt-8 rounded-xl border border-border bg-card p-5 shadow-soft">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            saveName.mutate();
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="display_name">Display name</Label>
            {profile.isLoading ? <Skeleton className="h-10 w-full" /> : <Input id="display_name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-10 rounded-xl" />}
          </div>
          <Button type="submit" variant="outline" disabled={saveName.isPending}>
            {saveName.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        </form>
      </section>

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{reports.data?.length ?? 0} reports</h2>
          <Button asChild variant="teal" size="sm"><Link to="/report"><PlusCircle /> New report</Link></Button>
        </div>
        {reports.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        {reports.data?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
            <FileX2 className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">You haven't reported anything yet</p>
            <p className="text-sm text-muted-foreground">Spotted a jam? Tell the city why it's happening.</p>
            <Button asChild variant="teal"><Link to="/report">Report an incident</Link></Button>
          </div>
        )}
        {reports.data?.map((inc) => (
          <article key={inc.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center">
            <TypeIconBubble type={inc.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{inc.location_name}</p>
              <p className="truncate text-sm text-muted-foreground">{typeMeta(inc.type).label} · {inc.ai_likely_cause} · {timeAgo(inc.created_at)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <SeverityBadge severity={inc.severity} />
                <StatusBadge status={inc.status} />
                {inc.is_anonymous && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">Anonymous</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/map" search={{ incident: inc.id }}><MapPinned /> Map</Link></Button>
              <Button variant="outline" size="sm" onClick={() => markCleared.mutate(inc)} disabled={markCleared.isPending}>
                {inc.status === "active" ? "Mark cleared" : "Reopen"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Delete report at ${inc.location_name}`}><Trash2 /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="z-[1300]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                    <AlertDialogDescription>It will be removed from the live map for everyone. This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate(inc)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
