import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

import { ruleBasedEstimate, type IncidentAnalysis, type IncidentType, type Severity } from "@/lib/incidents";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const analysisSchema = z.object({
  likely_cause: z.string(),
  explanation: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  estimated_delay_minutes: z.number(),
  estimated_clearance_minutes: z.number(),
  advice: z.string(),
});

export interface AnalyzeInput {
  type: IncidentType;
  description: string;
  severity: Severity;
  location: string;
  lat: number;
  lng: number;
  image?: { data: Uint8Array; mediaType: string } | null;
}

const INSTRUCTIONS = `You are TrafficSense AI, a traffic analyst for Indian cities (mainly Bengaluru).
Given a community incident report, explain WHY there is traffic in plain language a commuter understands.
Rules:
- explanation: 2-3 short, plain sentences. No jargon. Mention the location.
- likely_cause: a short phrase (max 10 words).
- severity: low, medium or high, based on lanes blocked, location importance and the description.
- estimated_delay_minutes: realistic extra minutes a commuter loses (1-120).
- estimated_clearance_minutes: realistic minutes until the cause is cleared (5-720). Construction can take hours.
- advice: one practical sentence (alternate road, timing, or transit).
- If a photo is attached, use it to verify and refine the cause. If the photo contradicts the reported type, say what the photo shows.`;

const clamp = (n: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));

export async function analyzeIncident(input: AnalyzeInput): Promise<{ analysis: IncidentAnalysis; source: "ai" | "fallback" }> {
  const fallback = ruleBasedEstimate(input.type, input.severity, input.description, input.location);
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { analysis: fallback, source: "fallback" };

  try {
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: GATEWAY_URL,
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const text = `Incident report:
- Type: ${input.type.replace("_", " ")}
- Reported severity: ${input.severity}
- Location: ${input.location} (${input.lat.toFixed(5)}, ${input.lng.toFixed(5)})
- Description: ${input.description || "(no description)"}
- Local time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`;

    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: Uint8Array; mediaType: string }
    > = [{ type: "text", text }];
    if (input.image) content.push({ type: "image", image: input.image.data, mediaType: input.image.mediaType });

    const result = streamText({
      model: provider.responses(MODEL),
      instructions: INSTRUCTIONS,
      messages: [{ role: "user", content }],
      output: Output.object({ schema: analysisSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const out = await result.output;
    return {
      source: "ai",
      analysis: {
        likely_cause: out.likely_cause.slice(0, 120) || fallback.likely_cause,
        explanation: out.explanation.slice(0, 800) || fallback.explanation,
        severity: out.severity,
        estimated_delay_minutes: clamp(out.estimated_delay_minutes, 1, 180),
        estimated_clearance_minutes: clamp(out.estimated_clearance_minutes, 5, 1440),
        advice: out.advice.slice(0, 400) || fallback.advice,
      },
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error("AI returned an unparseable analysis", error.text?.slice(0, 200));
    } else {
      console.error("AI analysis failed, using rule-based estimate", error);
    }
    return { analysis: fallback, source: "fallback" };
  }
}
