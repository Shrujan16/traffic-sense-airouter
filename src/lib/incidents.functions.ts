import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ruleBasedEstimate } from "@/lib/incidents";
import { analyzeIncident, type ReferenceReport } from "./ai/analyze.server";
import { distanceToPath } from "./geo";
import { actualClearanceMinutes, pickReferences } from "./learning";
import { toLiveCorridor, type CorridorRow } from "./traffic";

const reportSchema = z.object({
  type: z.enum(["accident", "breakdown", "construction", "signal_failure", "roadblock"]),
  description: z.string().trim().min(10).max(500),
  severity: z.enum(["low", "medium", "high"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  location_name: z.string().trim().min(2).max(200),
  image_path: z.string().max(300).nullable(),
  is_anonymous: z.boolean(),
});

export type ReportInput = z.infer<typeof reportSchema>;

export const reportIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.image_path && !data.image_path.startsWith(`${userId}/`)) {
      throw new Error("Invalid photo upload");
    }

    // 1. Save immediately with a rule-based estimate so the incident appears on the map right away.
    const quick = ruleBasedEstimate(data.type, data.severity, data.description, data.location_name);
    const { data: created, error: insertError } = await supabase
      .from("incidents")
      .insert({
        user_id: userId,
        is_anonymous: data.is_anonymous,
        type: data.type,
        description: data.description,
        severity: data.severity,
        lat: data.lat,
        lng: data.lng,
        location_name: data.location_name,
        image_url: data.image_path,
        estimated_delay: quick.estimated_delay_minutes,
        estimated_clearance: quick.estimated_clearance_minutes,
        ai_likely_cause: quick.likely_cause,
        ai_explanation: quick.explanation,
        ai_advice: quick.advice,
        ai_source: "rules",
      })
      .select("*")
      .single();
    if (insertError || !created) {
      console.error("Insert failed", insertError);
      throw new Error("We couldn't save your report. Please try again.");
    }

    // 2. Load the photo (if any) so the AI can verify the cause.
    let image: { data: Uint8Array; mediaType: string } | null = null;
    if (data.image_path) {
      const { data: blob } = await supabase.storage.from("incident-images").download(data.image_path);
      if (blob) image = { data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" };
    }

    // 3. Learn from community-confirmed reports: similar cause, real clearance times and photos.
    const { data: pool } = await supabase
      .from("incidents")
      .select("id, type, description, location_name, lat, lng, status, created_at, cleared_at, still_there_count, cleared_count, upvotes, image_url, ai_likely_cause, estimated_delay")
      .neq("id", created.id)
      .or("status.eq.cleared,still_there_count.gte.2,upvotes.gte.2")
      .order("created_at", { ascending: false })
      .limit(300);
    const picked = pickReferences(pool ?? [], { id: created.id, type: data.type, lat: data.lat, lng: data.lng });
    let photosLeft = 2;
    const references: ReferenceReport[] = await Promise.all(
      picked.map(async ({ report: r, km }) => {
        let photo: ReferenceReport["photo"] = null;
        if (r.image_url && photosLeft > 0 && !/^https?:/.test(r.image_url)) {
          photosLeft -= 1;
          const { data: blob } = await supabase.storage.from("incident-images").download(r.image_url);
          if (blob && blob.size < 5_000_000) photo = { data: new Uint8Array(await blob.arrayBuffer()), mediaType: blob.type || "image/jpeg" };
        }
        return {
          type: r.type,
          location: r.location_name,
          distanceKm: km,
          description: r.description.slice(0, 300),
          confirmedCause: r.ai_likely_cause,
          confirmations: r.still_there_count + r.cleared_count + r.upvotes,
          status: r.status,
          actualClearanceMinutes: actualClearanceMinutes(r),
          estimatedDelayMinutes: r.estimated_delay,
          photo,
        };
      }),
    );

    // 4. Live Google traffic on main roads within 1.5 km.
    const { data: corridorRows } = await supabase.from("traffic_corridors").select("*");
    const liveTraffic = (corridorRows ?? [])
      .map((row) => toLiveCorridor(row as CorridorRow))
      .map((c) => ({ name: c.name, delayMin: c.delayMin, usualMin: c.usualMin, distanceM: distanceToPath([data.lat, data.lng], c.path) }))
      .filter((c) => c.distanceM <= 1500)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 3);

    // 5. AI analysis (falls back to rules on failure).
    const { analysis, source } = await analyzeIncident({
      type: data.type,
      description: data.description,
      severity: data.severity,
      location: data.location_name,
      lat: data.lat,
      lng: data.lng,
      image,
      references,
      liveTraffic,
    });

    const { data: updated, error: updateError } = await supabase
      .from("incidents")
      .update({
        severity: analysis.severity,
        estimated_delay: analysis.estimated_delay_minutes,
        estimated_clearance: analysis.estimated_clearance_minutes,
        ai_likely_cause: analysis.likely_cause,
        ai_explanation: analysis.explanation,
        ai_advice: analysis.advice,
        ai_source: source,
        ai_reference_count: source === "ai" ? references.length : 0,
      })
      .eq("id", created.id)
      .select("*")
      .single();
    if (updateError) console.error("Update with AI analysis failed", updateError);

    return { incident: updated ?? created, analysisSource: source };
  });
