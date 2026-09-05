import { describe, expect, it } from "vitest";

import { buildCplReasoningText } from "./reasoning.js";

describe("buildCplReasoningText", () => {
  it("cites the real breakevenCpl number when business context is filled in", () => {
    const text = buildCplReasoningText({
      cplIDR: 37_421,
      benchmarkCplIDR: 20_000,
      cplMultiplier: 1.5,
      breakevenCpl: 30_000,
    });
    expect(text).toContain("37.421");
    expect(text).toContain("30.000");
    expect(text).toContain("PAUSE");
    expect(text).not.toContain("Cost per hasil terlalu tinggi");
  });

  it("falls back to the generic threshold sentence when breakevenCpl is undefined", () => {
    const text = buildCplReasoningText({
      cplIDR: 37_421,
      benchmarkCplIDR: 21_000,
      cplMultiplier: 1.5,
    });
    expect(text).toContain("Cost per hasil terlalu tinggi");
    expect(text).toContain("Isi konteks bisnis");
    // 21_000 * 1.5 = 31.500 — a different real threshold than the "cites a real breakevenCpl"
    // test's 30.000, so this assertion can never coincidentally pass for the wrong reason.
    expect(text).not.toContain("30.000");
  });

  it("falls back to the generic threshold sentence when breakevenCpl is 0 (not real business context)", () => {
    const text = buildCplReasoningText({
      cplIDR: 37_421,
      benchmarkCplIDR: 20_000,
      cplMultiplier: 1.5,
      breakevenCpl: 0,
    });
    expect(text).toContain("Cost per hasil terlalu tinggi");
  });
});
