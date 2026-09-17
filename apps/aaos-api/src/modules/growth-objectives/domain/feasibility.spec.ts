import { describe, expect, it } from "vitest";

import { assessFeasibility } from "./feasibility.js";
import type { ReverseFunnelResult } from "./reverse-funnel.js";

function makeReverseFunnel(overrides: Partial<ReverseFunnelResult> = {}): ReverseFunnelResult {
  return {
    conversionRate: 0.2,
    estimatedRequiredRawLeads: { min: 200, expected: 250, max: 300 },
    estimatedMediaSpendIdr: { min: 4_000_000, expected: 5_000_000, max: 6_000_000 },
    confidence: 0.8,
    ...overrides,
  };
}

describe("assessFeasibility", () => {
  it("INSUFFICIENT_DATA when reverseFunnel.confidence is below the threshold", () => {
    const result = assessFeasibility({
      reverseFunnel: { conversionRate: undefined, confidence: 0 },
      daysRemaining: 30,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.confidence).toBe(0);
    expect(result.options).toEqual([]);
  });

  it("INSUFFICIENT_DATA when estimatedRequiredRawLeads is undefined (0% conversion rate)", () => {
    const result = assessFeasibility({
      reverseFunnel: { conversionRate: 0, confidence: 0.9 },
      daysRemaining: 30,
    });
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.reasons[0]).toMatch(/Hot Lead/);
  });

  it("UNLIKELY when daysRemaining is 0", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel(),
      daysRemaining: 0,
    });
    expect(result.status).toBe("UNLIKELY");
    expect(result.options).toContain("EXTEND_TIMELINE");
  });

  it("ACHIEVABLE when pace is well within current daily lead capacity", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 80, expected: 100, max: 120 },
        estimatedMediaSpendIdr: { min: 1_600_000, expected: 2_000_000, max: 2_400_000 },
      }),
      daysRemaining: 100, // pace = 1/day; impliedCpl = 20,000; capacity = 1,000,000/20,000 = 50/day
      currentDailySpendCapacityIdr: 1_000_000,
    });
    expect(result.status).toBe("ACHIEVABLE");
  });

  it("AGGRESSIVE when pace is close to capacity (ratio between 0.7 and 1.0)", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 700, expected: 900, max: 1100 }, // pace = 9/day over 100 days
        estimatedMediaSpendIdr: { min: 14_000_000, expected: 18_000_000, max: 22_000_000 }, // impliedCpl = 20,000
      }),
      daysRemaining: 100,
      currentDailySpendCapacityIdr: 200_000, // capacity = 10/day; ratio = 0.9
    });
    expect(result.status).toBe("AGGRESSIVE");
  });

  it("AGGRESSIVE with unconfirmed pacing when no budget-capacity/CPL basis exists", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({ estimatedMediaSpendIdr: undefined }),
      daysRemaining: 30,
    });
    expect(result.status).toBe("AGGRESSIVE");
    expect(result.confidence).toBeLessThan(makeReverseFunnel().confidence);
    expect(result.reasons.some((r) => r.includes("belum bisa dikonfirmasi"))).toBe(true);
  });

  it("AT_RISK when pace exceeds capacity moderately (ratio between 1.0 and 1.5)", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 900, expected: 1200, max: 1500 }, // pace = 12/day
        estimatedMediaSpendIdr: { min: 18_000_000, expected: 24_000_000, max: 30_000_000 }, // impliedCpl=20,000
      }),
      daysRemaining: 100,
      currentDailySpendCapacityIdr: 200_000, // capacity=10/day; ratio=1.2
    });
    expect(result.status).toBe("AT_RISK");
    expect(result.options).toContain("INCREASE_BUDGET");
    expect(result.options).toContain("IMPROVE_CONVERSION");
    expect(result.options).toContain("EXTEND_TIMELINE");
  });

  it("UNLIKELY when pace far exceeds capacity (ratio above 1.5)", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 1500, expected: 2000, max: 2500 }, // pace = 20/day
        estimatedMediaSpendIdr: { min: 30_000_000, expected: 40_000_000, max: 50_000_000 }, // impliedCpl=20,000
      }),
      daysRemaining: 100,
      currentDailySpendCapacityIdr: 200_000, // capacity=10/day; ratio=2.0
    });
    expect(result.status).toBe("UNLIKELY");
    expect(result.options).toEqual(
      expect.arrayContaining([
        "INCREASE_BUDGET",
        "REDUCE_TARGET",
        "IMPROVE_CONVERSION",
        "EXTEND_TIMELINE",
      ]),
    );
  });

  it("budget-ceiling-exceeded case pushes status to at least AT_RISK and adds INCREASE_BUDGET/REDUCE_TARGET", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 80, expected: 100, max: 120 },
        estimatedMediaSpendIdr: { min: 8_000_000, expected: 10_000_000, max: 12_000_000 },
      }),
      daysRemaining: 100,
      currentDailySpendCapacityIdr: 1_000_000, // would otherwise be ACHIEVABLE
      maxBudgetIdr: 5_000_000, // but estimated spend (10M) exceeds this ceiling
    });
    expect(result.status).toBe("AT_RISK");
    expect(result.options).toContain("INCREASE_BUDGET");
    expect(result.options).toContain("REDUCE_TARGET");
  });

  it("budget-ceiling-exceeded case never downgrades an already-worse status", () => {
    const result = assessFeasibility({
      reverseFunnel: makeReverseFunnel({
        estimatedRequiredRawLeads: { min: 1500, expected: 2000, max: 2500 },
        estimatedMediaSpendIdr: { min: 30_000_000, expected: 40_000_000, max: 50_000_000 },
      }),
      daysRemaining: 100,
      currentDailySpendCapacityIdr: 200_000,
      maxBudgetIdr: 5_000_000,
    });
    expect(result.status).toBe("UNLIKELY");
  });
});
