import { useEffect } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { typeMeta, type Incident } from "@/lib/incidents";

export const incidentsQuery = queryOptions({
  queryKey: ["incidents"],
  queryFn: async (): Promise<Incident[]> => {
    const { data, error } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  staleTime: 30_000,
});

/** All incidents, kept fresh through realtime changes. */
export function useIncidents({ live = true, notify = false }: { live?: boolean; notify?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(incidentsQuery);

  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel(`incidents-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, (payload) => {
        queryClient.setQueryData<Incident[]>(incidentsQuery.queryKey, (prev = []) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Incident;
            if (prev.some((p) => p.id === row.id)) return prev;
            if (notify) toast(`New ${typeMeta(row.type).label.toLowerCase()} reported`, { description: row.location_name });
            return [row, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Incident;
            return prev.map((p) => (p.id === row.id ? row : p));
          }
          if (payload.eventType === "DELETE") {
            const id = (payload.old as Partial<Incident>).id;
            return prev.filter((p) => p.id !== id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [live, notify, queryClient]);

  return query;
}

export function useSignedImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["incident-image", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      const { data, error } = await supabase.storage.from("incident-images").createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}
