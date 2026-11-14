import { describe, expect, it } from "vitest";

import { applyFilters, DEFAULT_FILTERS } from "@/components/map/FilterBar";
import { ruleBasedEstimate } from "@/lib/incidents";

describe("rule-based fallback estimate", () => {
  it("high severity accidents cause a longer delay than low severity ones", () => {
    const high = ruleBasedEstimate("accident", "high");
    const low = ruleBasedEstimate("accident", "low");
    expect(high.estimated_delay_minutes).toBe(34);
    expect(low.estimated_delay_minutes).toBe(10);
  });

  it("construction clearance stays at hours regardless of severity", () => {
    expect(ruleBasedEstimate("construction", "low").estimated_clearance_minutes).toBe(240);
    expect(ruleBasedEstimate("construction", "high").estimated_clearance_minutes).toBe(240);
  });

  it("keeps the reported severity", () => {
    expect(ruleBasedEstimate("roadblock", "medium").severity).toBe("medium");
  });
});

describe("map filters", () => {
  const now = new Date("2026-11-14T10:00:00Z").getTime();
  const items = [
    { type: "accident", severity: "high", created_at: "2026-11-14T09:30:00Z", location_name: "Hebbal Flyover", description: "" },
    { type: "construction", severity: "low", created_at: "2026-11-14T02:00:00Z", location_name: "Outer Ring Road", description: "" },
  ];

  it("last 1h hides older incidents", () => {
    expect(applyFilters(items, { ...DEFAULT_FILTERS, time: "1h" }, now).map((i) => i.location_name)).toEqual(["Hebbal Flyover"]);
  });

  it("search matches road names case-insensitively", () => {
    expect(applyFilters(items, { ...DEFAULT_FILTERS, search: "ring road" }, now)).toHaveLength(1);
  });
});
