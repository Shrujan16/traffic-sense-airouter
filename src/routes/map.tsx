import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { List, LocateFixed, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { FilterBar, applyFilters, DEFAULT_FILTERS, type MapFilters } from "@/components/map/FilterBar";
import { IncidentList, sortIncidents, type SortMode } from "@/components/map/IncidentList";
import { IncidentPanel } from "@/components/map/IncidentPanel";
import { MapLegend } from "@/components/map/MapLegend";
import type { MapFocus } from "@/components/map/MapView";
import { useIncidents } from "@/hooks/use-incidents";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildAlternateRoute, geocode, type LatLng, type SuggestedRoute } from "@/lib/geo";
import { cn } from "@/lib/utils";

const MapView = lazy(() => import("@/components/map/MapView"));

export const Route = createFileRoute("/map")({
  validateSearch: (search: Record<string, unknown>): { incident?: string | undefined } => ({
    incident: typeof search["incident"] === "string" ? search["incident"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live Traffic Map – Bengaluru incidents explained | TrafficSense AI" },
      { name: "description", content: "Live map of accidents, breakdowns, construction, signal failures and roadblocks in Bengaluru, with AI explanations of why traffic is building." },
      { property: "og:title", content: "Live Traffic Map | TrafficSense AI" },
      { property: "og:description", content: "See every incident on the map and understand why the traffic is there." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapFallback() {
  return (
    <div className="grid h-full w-full place-items-center bg-muted">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
      </div>
    </div>
  );
}

function MapPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/map" });
  const isMobile = useIsMobile();
  const { data: incidents = [], isLoading, isError, refetch } = useIncidents({ notify: true });

  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortMode>("newest");
  const [listOpen, setListOpen] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [route, setRoute] = useState<(SuggestedRoute & { incidentId: string }) | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const selectedId = search.incident ?? null;
  const filtered = useMemo(() => sortIncidents(applyFilters(incidents, filters), sort), [incidents, filters, sort]);
  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) ?? null, [incidents, selectedId]);

  useEffect(() => {
    if (window.innerWidth >= 1024) setListOpen(true);
  }, []);

  // Fly to an incident opened from a shared link
  useEffect(() => {
    if (selected && !focus) setFocus({ lat: selected.lat, lng: selected.lng, zoom: 15, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const select = useCallback(
    (id: string | null) => {
      navigate({ search: { incident: id ?? undefined }, replace: true });
      if (id) {
        const inc = incidents.find((i) => i.id === id);
        if (inc) setFocus({ lat: inc.lat, lng: inc.lng, key: Date.now() });
        if (isMobile) setListOpen(false);
      }
      if (route && route.incidentId !== id) setRoute(null);
    },
    [navigate, incidents, isMobile, route],
  );

  function locate() {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(p);
        setFocus({ lat: p[0], lng: p[1], zoom: 14, key: Date.now() });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was denied" : "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSearchSubmit(q: string) {
    if (!q) return;
    const first = filtered[0];
    if (first) {
      setFocus({ lat: first.lat, lng: first.lng, zoom: 14, key: Date.now() });
      return;
    }
    try {
      const results = await geocode(`${q}, Bengaluru`);
      const top = results[0];
      if (!top) {
        toast("No place found for that search");
        return;
      }
      setFocus({ lat: top.lat, lng: top.lng, zoom: 15, key: Date.now() });
      toast(`Showing ${top.label}`, { description: "No incidents reported here right now." });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function suggestRoute() {
    if (!selected) return;
    setRouteLoading(true);
    try {
      const r = await buildAlternateRoute(selected);
      setRoute({ ...r, incidentId: selected.id });
      if (isMobile) toast.success("Suggested route drawn on the map");
    } catch {
      toast.error("Couldn't build a route right now");
    } finally {
      setRouteLoading(false);
    }
  }

  const activeRoute = route && route.incidentId === selectedId ? route : null;

  const panel = selected ? (
    <IncidentPanel
      incident={selected}
      onClose={() => select(null)}
      route={activeRoute}
      routeLoading={routeLoading}
      onSuggestRoute={suggestRoute}
      onClearRoute={() => setRoute(null)}
    />
  ) : null;

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden">
      <ClientOnly fallback={<MapFallback />}>
        <Suspense fallback={<MapFallback />}>
          <MapView
            incidents={filtered}
            selectedId={selectedId}
            onSelect={(id) => select(id)}
            route={activeRoute}
            userLocation={userLocation}
            focus={focus}
          />
        </Suspense>
      </ClientOnly>

      {/* Filters */}
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 sm:p-4", listOpen && "lg:pl-[22rem]", selected && "md:pr-[26rem]")}>
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <FilterBar filters={filters} onChange={setFilters} onSearchSubmit={onSearchSubmit} resultCount={filtered.length} />
        </div>
      </div>

      {/* List */}
      {listOpen ? (
        <div className="absolute inset-x-2 bottom-2 top-[7.5rem] z-[1050] animate-fade-up sm:inset-x-4 lg:bottom-4 lg:left-4 lg:right-auto lg:top-4 lg:w-80">
          <IncidentList
            incidents={filtered}
            loading={isLoading}
            selectedId={selectedId}
            onSelect={(id) => select(id)}
            sort={sort}
            onSortChange={setSort}
            onClose={() => setListOpen(false)}
          />
        </div>
      ) : (
        <Button variant="outline" className="absolute left-3 top-[7.5rem] z-[1000] rounded-full shadow-elevated sm:left-4" onClick={() => setListOpen(true)}>
          <List /> List
        </Button>
      )}

      {/* Locate */}
      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-24 right-3 z-[1000] h-10 w-10 rounded-full shadow-elevated"
        onClick={locate}
        aria-label="Locate me"
        disabled={locating}
      >
        {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
      </Button>

      {/* Legend */}
      <MapLegend className={cn("absolute bottom-10 left-3 z-[1000] hidden w-44 sm:block sm:left-4", listOpen && "lg:left-[22rem]")} />

      {/* Disclaimer */}
      <p className="absolute bottom-2 left-2 right-16 z-[1000] rounded-full glass px-3 py-1 text-center text-[10px] leading-tight text-muted-foreground shadow-soft sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:text-[11px]">
        <ShieldAlert className="mr-1 inline h-3 w-3" />
        Reports are community-submitted and AI explanations are estimates.
      </p>

      {isError && (
        <div className="absolute left-1/2 top-32 z-[1100] -translate-x-1/2 rounded-xl border border-destructive/40 bg-card p-3 text-sm shadow-elevated">
          Couldn't load incidents.{" "}
          <button className="font-semibold text-teal underline" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {/* Detail: desktop side panel */}
      {selected && !isMobile && (
        <aside className="absolute bottom-4 right-4 top-4 z-[1050] w-[24rem] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-elevated animate-in slide-in-from-right-4 fade-in" aria-label="Incident details">
          {panel}
        </aside>
      )}

      {/* Detail: mobile bottom sheet */}
      {isMobile && (
        <Drawer open={!!selected} onOpenChange={(o) => !o && select(null)} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerTitle className="sr-only">Incident details</DrawerTitle>
            <div className="overflow-y-auto px-4 pb-6 pt-3">{panel}</div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
