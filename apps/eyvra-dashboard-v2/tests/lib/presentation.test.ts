import { describe, expect, it } from "vitest";
import { getMetricDeltaIntent, presentLabel, presentText } from "@/lib/presentation";

describe("metric meaning", () => {
  it.each(["cpl", "cpql", "cpc", "frequency"])("treats a %s increase as adverse", (metric) => {
    expect(getMetricDeltaIntent(metric, 0.4)).toBe("bad");
    expect(getMetricDeltaIntent(metric, -0.4)).toBe("good");
  });
  it.each(["ctr", "leads", "qualifiedLeads", "bookings"])(
    "treats a %s increase as improvement",
    (metric) => {
      expect(getMetricDeltaIntent(metric, 0.2)).toBe("good");
      expect(getMetricDeltaIntent(metric, -0.2)).toBe("bad");
    },
  );
  it("does not guess unknown meaning, zero change, or invalid measurements", () => {
    expect(getMetricDeltaIntent("spend", 0.2)).toBe("neutral");
    expect(getMetricDeltaIntent("ctr", 0)).toBe("neutral");
    expect(getMetricDeltaIntent("cpl", NaN)).toBe("neutral");
  });
  it("maps event and diagnostic codes into display copy", () => {
    expect(presentLabel("EXECUTE_VERDICT")).toBe("Applied campaign decision");
    expect(presentText("Root cause CREATIVE_FATIGUE")).toBe("Root cause Creative fatigue");
  });

  /**
   * Real bug (observed live, 2026-09-21): the generic fallback title-cased any unmapped ALL-CAPS
   * token, so a real reasoning string "CTR turun 50% dibanding baseline." rendered as "Ctr turun
   * 50%…" in the Agent Activity rail. Industry-standard metric acronyms must pass through verbatim.
   */
  it("preserves real metric acronyms instead of title-casing them", () => {
    expect(presentLabel("CTR")).toBe("CTR");
    expect(presentLabel("CPQL")).toBe("CPQL");
    expect(presentText("CTR turun 50% dibanding baseline.")).toBe(
      "CTR turun 50% dibanding baseline.",
    );
    expect(presentText("CPL naik 41%, CTR turun 50%")).toBe("CPL naik 41%, CTR turun 50%");
    // Internal enum names must still be translated, not passed through.
    expect(presentText("Root cause CPL_SPIKE detected")).toBe(
      "Root cause Cost per lead increased detected",
    );
  });
});
