import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Crosshair, Loader2, MapPin, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { incidentsQuery } from "@/hooks/use-incidents";
import { supabase } from "@/integrations/supabase/client";
import { geocode, reverseGeocode, type GeocodeResult } from "@/lib/geo";
import { INCIDENT_TYPES, type Incident, type IncidentType, type Severity } from "@/lib/incidents";
import { cn } from "@/lib/utils";
import { reportIncident } from "@/lib/incidents.functions";
import { PhotoDropzone } from "./PhotoDropzone";

const LocationPicker = lazy(() => import("./LocationPicker"));

const formSchema = z.object({
  type: z.enum(["accident", "breakdown", "construction", "signal_failure", "roadblock"], {
    errorMap: () => ({ message: "Choose what's causing the traffic" }),
  }),
  description: z
    .string()
    .trim()
    .min(10, "Add a few more words (at least 10 characters) so others understand")
    .max(500, "Keep it under 500 characters"),
  severity: z.enum(["low", "medium", "high"]),
  lat: z.number({
    invalid_type_error: "Drop a pin on the map, use your location, or search an address",
    required_error: "Drop a pin on the map, use your location, or search an address",
  }),
  lng: z.number(),
  location_name: z.string().trim().min(2, "Give the location a short name (e.g. Silk Board Junction)").max(200),
});

type Errors = Partial<Record<"type" | "description" | "severity" | "lat" | "location_name" | "photo", string | undefined>>;

export interface ReportSuccess {
  incident: Incident;
  analysisSource: "ai" | "fallback";
}

const SEVERITIES: { value: Severity; label: string; hint: string; cls: string }[] = [
  { value: "low", label: "Low", hint: "Slow but moving", cls: "data-[on=true]:border-sev-low data-[on=true]:bg-sev-low/12 data-[on=true]:text-sev-low" },
  { value: "medium", label: "Medium", hint: "Long queues", cls: "data-[on=true]:border-sev-medium data-[on=true]:bg-sev-medium/15 data-[on=true]:text-sev-medium" },
  { value: "high", label: "High", hint: "Road blocked", cls: "data-[on=true]:border-sev-high data-[on=true]:bg-sev-high/12 data-[on=true]:text-sev-high" },
];

export function ReportForm({ onSuccess }: { onSuccess: (r: ReportSuccess) => void }) {
  const { user } = useAuth();
  const submitFn = useServerFn(reportIncident);
  const queryClient = useQueryClient();

  const [type, setType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<null | "upload" | "analyze">(null);

  const [address, setAddress] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const nameTouched = useRef(false);

  useEffect(() => {
    if (!point) return;
    let cancelled = false;
    void reverseGeocode(point.lat, point.lng).then((name) => {
      if (!cancelled && name && !nameTouched.current) setLocationName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [point]);

  function pick(lat: number, lng: number, label?: string) {
    setPoint({ lat, lng });
    setErrors((e) => ({ ...e, lat: undefined }));
    if (label) {
      nameTouched.current = false;
      setLocationName(label);
    } else nameTouched.current = false;
  }

  async function searchAddress(e?: FormEvent) {
    e?.preventDefault();
    if (address.trim().length < 3) return;
    setSearching(true);
    try {
      const r = await geocode(`${address}, Bengaluru`);
      setResults(r);
      if (!r.length) toast("No matching address found");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Location isn't supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pick(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was denied" : "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const parsed = formSchema.safeParse({
      type: type ?? undefined,
      description,
      severity,
      lat: point?.lat,
      lng: point?.lng,
      location_name: locationName,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof Errors;
        if (!next[k]) next[k] = issue.message;
      }
      setErrors((prev) => ({ photo: prev.photo, ...next }));
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});

    let imagePath: string | null = null;
    try {
      if (photo) {
        setStep("upload");
        const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("incident-images").upload(path, photo, { contentType: photo.type, upsert: false });
        if (error) throw new Error(`Photo upload failed: ${error.message}`);
        imagePath = path;
      }
      setStep("analyze");
      const res = await submitFn({
        data: { ...parsed.data, image_path: imagePath, is_anonymous: anonymous },
      });
      queryClient.setQueryData<Incident[]>(incidentsQuery.queryKey, (prev) =>
        prev ? [res.incident, ...prev.filter((p) => p.id !== res.incident.id)] : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["my-reports"] });
      onSuccess(res as ReportSuccess);
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setStep(null);
    }
  }

  const busy = step !== null;

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      {/* Type */}
      <fieldset aria-describedby={errors.type ? "type-error" : undefined}>
        <legend className="text-sm font-semibold">What's causing the traffic? <span className="text-destructive">*</span></legend>
        <div role="radiogroup" aria-label="Incident type" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {INCIDENT_TYPES.map((t) => {
            const on = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-invalid={!!errors.type && !type}
                onClick={() => {
                  setType(t.value);
                  setErrors((e) => ({ ...e, type: undefined }));
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-soft",
                  on ? "border-transparent ring-2 ring-teal" : "border-border",
                  errors.type && !type && "border-destructive",
                )}
              >
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl text-navy-foreground", t.bg)}>
                  <t.icon className="h-5 w-5" size={20} />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
        {errors.type && <p id="type-error" className="mt-2 text-xs font-medium text-destructive">{errors.type}</p>}
      </fieldset>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-semibold">Short description <span className="text-destructive">*</span></Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((er) => ({ ...er, description: undefined }));
          }}
          maxLength={500}
          rows={3}
          placeholder="e.g. Bus broken down in the middle lane, traffic backed up to the flyover"
          aria-invalid={!!errors.description}
          aria-describedby="description-help"
          className={cn("rounded-xl", errors.description && "border-destructive")}
        />
        <div id="description-help" className="flex justify-between text-xs">
          <span className={errors.description ? "font-medium text-destructive" : "text-muted-foreground"}>
            {errors.description ?? "Describe what you see — lanes blocked, vehicles involved, police present."}
          </span>
          <span className="text-muted-foreground">{description.length}/500</span>
        </div>
      </div>

      {/* Severity */}
      <fieldset>
        <legend className="text-sm font-semibold">How bad is it?</legend>
        <div role="radiogroup" aria-label="Severity" className="mt-3 grid grid-cols-3 gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={severity === s.value}
              data-on={severity === s.value}
              onClick={() => setSeverity(s.value)}
              className={cn("rounded-xl border border-border bg-card p-3 text-left transition-all hover:shadow-soft", s.cls)}
            >
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-xs opacity-80">{s.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Location */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Where is it? <span className="text-destructive">*</span></legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchAddress();
                }
              }}
              placeholder="Type an address or landmark"
              aria-label="Search address"
              className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void searchAddress()} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Search />} Search
          </Button>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my location
          </Button>
        </div>
        {results.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-label="Address results">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    pick(r.lat, r.lng, r.label);
                    setResults([]);
                  }}
                >
                  <MapPin className="h-4 w-4 shrink-0 text-teal" /> {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={cn("h-64 overflow-hidden rounded-xl border sm:h-72", errors.lat ? "border-destructive" : "border-border")} aria-invalid={!!errors.lat} tabIndex={errors.lat ? -1 : undefined}>
          <ClientOnly fallback={<div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>}>
            <Suspense fallback={<div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">Loading map…</div>}>
              <LocationPicker value={point} onPick={(lat, lng) => pick(lat, lng)} />
            </Suspense>
          </ClientOnly>
        </div>
        <p className={cn("text-xs", errors.lat ? "font-medium text-destructive" : "text-muted-foreground")}>
          {errors.lat ?? (point ? `Pin at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — drag it to adjust.` : "Click the map to drop a pin.")}
        </p>
        <div className="space-y-2">
          <Label htmlFor="location_name">Location name <span className="text-destructive">*</span></Label>
          <input
            id="location_name"
            value={locationName}
            onChange={(e) => {
              nameTouched.current = true;
              setLocationName(e.target.value);
              if (errors.location_name) setErrors((er) => ({ ...er, location_name: undefined }));
            }}
            maxLength={200}
            placeholder="e.g. Silk Board Junction"
            aria-invalid={!!errors.location_name}
            className={cn(
              "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/30",
              errors.location_name && "border-destructive",
            )}
          />
          {errors.location_name && <p className="text-xs font-medium text-destructive">{errors.location_name}</p>}
        </div>
      </fieldset>

      {/* Photo */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Photo <span className="font-normal text-muted-foreground">(optional)</span></p>
        <PhotoDropzone file={photo} onChange={setPhoto} error={errors.photo} onError={(m) => setErrors((e) => ({ ...e, photo: m }))} />
        {errors.photo && <p className="text-xs font-medium text-destructive">{errors.photo}</p>}
      </div>

      {/* Anonymous */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
        <div>
          <Label htmlFor="anonymous" className="text-sm font-semibold">Report anonymously</Label>
          <p className="text-xs text-muted-foreground">Your name won't be shown with this report.</p>
        </div>
        <Switch id="anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
      </div>

      <Button type="submit" variant="teal" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Send />}
        {step === "upload" ? "Uploading photo…" : step === "analyze" ? "AI is analyzing the cause…" : "Submit report"}
      </Button>
    </form>
  );
}
