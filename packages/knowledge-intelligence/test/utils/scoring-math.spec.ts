import { describe, expect, it } from "vitest";

import {
  clamp,
  computeCompositeScore,
  evaluateThreshold,
  normalizeToScore,
  weightedAverage,
} from "../../src/utils/scoring-math.js";

describe("clamp", () => {
  it("clamps below the minimum", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it("clamps above the maximum", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it("passes through values within range", () => {
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe("normalizeToScore", () => {
  it("normalizes a mid-range value to 50", () => {
    expect(normalizeToScore(5, 0, 10)).toBe(50);
  });

  it("normalizes the minimum to 0", () => {
    expect(normalizeToScore(0, 0, 10)).toBe(0);
  });

  it("normalizes the maximum to 100", () => {
    expect(normalizeToScore(10, 0, 10)).toBe(100);
  });

  it("clamps values above the max to 100", () => {
    expect(normalizeToScore(20, 0, 10)).toBe(100);
  });

  it("clamps values below the min to 0", () => {
    expect(normalizeToScore(-5, 0, 10)).toBe(0);
  });

  it("handles a degenerate range (min === max) at or above min as 100", () => {
    expect(normalizeToScore(5, 5, 5)).toBe(100);
  });

  it("handles a degenerate range (min === max) below min as 0", () => {
    expect(normalizeToScore(4, 5, 5)).toBe(0);
  });
});

describe("normalizeToScore — known-value table", () => {
  it.each<[number, number, number, number]>([
    [0, 0, 100, 0],
    [25, 0, 100, 25],
    [50, 0, 100, 50],
    [100, 0, 100, 100],
    [50, 0, 200, 25],
    [10, 10, 20, 0],
    [20, 10, 20, 100],
    [15, 10, 20, 50],
    [-10, -20, 0, 50],
    [3, 0, 4, 75],
  ])("normalizeToScore(%p, %p, %p) === %p", (value, min, max, expected) => {
    expect(normalizeToScore(value, min, max)).toBeCloseTo(expected, 10);
  });
});

describe("normalizeToScore — identity sweep over the [0, 100] range", () => {
  it.each(Array.from({ length: 101 }, (_, value) => value))(
    "normalizeToScore(%i, 0, 100) is the identity function on this range",
    (value) => {
      expect(normalizeToScore(value, 0, 100)).toBeCloseTo(value, 9);
    },
  );
});

describe("weightedAverage", () => {
  it("computes the exact weighted average for known sub-scores/weights", () => {
    // (80*0.5 + 60*0.3 + 40*0.2) / (0.5+0.3+0.2) = (40+18+8)/1 = 66
    const result = weightedAverage([
      { name: "a", value: 80, weight: 0.5 },
      { name: "b", value: 60, weight: 0.3 },
      { name: "c", value: 40, weight: 0.2 },
    ]);
    expect(result).toBeCloseTo(66, 10);
  });

  it("normalizes weights that don't sum to 1", () => {
    // weights 2 and 2 (sum 4) with values 100 and 0 -> average 50
    const result = weightedAverage([
      { name: "a", value: 100, weight: 2 },
      { name: "b", value: 0, weight: 2 },
    ]);
    expect(result).toBeCloseTo(50, 10);
  });

  it("throws for an empty signal list", () => {
    expect(() => weightedAverage([])).toThrow(RangeError);
  });

  it("throws when total weight is <= 0", () => {
    expect(() => weightedAverage([{ name: "a", value: 50, weight: 0 }])).toThrow(RangeError);
  });

  it("clamps the result into [0, 100]", () => {
    const result = weightedAverage([{ name: "a", value: 200, weight: 1 }]);
    expect(result).toBe(100);
  });
});

describe("weightedAverage — known equal-weight table", () => {
  it.each<[readonly number[], number]>([
    [[0, 100], 50],
    [[100, 100], 100],
    [[0, 0], 0],
    [[10, 20, 30], 20],
    [[25, 50, 75, 100], 62.5],
    [[90, 80, 70], 80],
    [[100], 100],
    [[0], 0],
  ])("equal-weight average of %j === %p", (values, expected) => {
    const signals = values.map((value, index) => ({ name: `s${index}`, value, weight: 1 }));
    expect(weightedAverage(signals)).toBeCloseTo(expected, 10);
  });
});

describe("evaluateThreshold", () => {
  const bands = [
    { label: "healthy", min: 80 },
    { label: "at_risk", min: 50 },
    { label: "critical", min: 0 },
  ];

  it.each<[number, string]>([
    [0, "critical"],
    [10, "critical"],
    [49, "critical"],
    [50, "at_risk"],
    [65, "at_risk"],
    [79, "at_risk"],
    [80, "healthy"],
    [95, "healthy"],
    [100, "healthy"],
  ])("evaluateThreshold(%p) === %p", (score, expected) => {
    expect(evaluateThreshold(score, bands)).toBe(expected);
  });

  it("selects the correct band for a high score", () => {
    expect(evaluateThreshold(90, bands)).toBe("healthy");
  });

  it("selects the correct band for a mid score", () => {
    expect(evaluateThreshold(65, bands)).toBe("at_risk");
  });

  it("selects the correct band for a low score", () => {
    expect(evaluateThreshold(10, bands)).toBe("critical");
  });

  it("is inclusive of the band's minimum boundary", () => {
    expect(evaluateThreshold(80, bands)).toBe("healthy");
    expect(evaluateThreshold(50, bands)).toBe("at_risk");
  });

  it("works when bands are supplied out of order", () => {
    const shuffled = [bands[2]!, bands[0]!, bands[1]!];
    expect(evaluateThreshold(85, shuffled)).toBe("healthy");
  });

  it("throws when no band matches", () => {
    expect(() =>
      evaluateThreshold(
        -1,
        [{ label: "only", min: 0 }].map((b) => ({ ...b, min: 10 })),
      ),
    ).toThrow(RangeError);
  });
});

describe("evaluateThreshold — full integer sweep against the default health bands", () => {
  const healthBands = [
    { label: "healthy", min: 80 },
    { label: "at_risk", min: 50 },
    { label: "critical", min: 0 },
  ];

  function expectedHealthBand(score: number): string {
    if (score >= 80) return "healthy";
    if (score >= 50) return "at_risk";
    return "critical";
  }

  it.each(Array.from({ length: 101 }, (_, score) => score))(
    "evaluateThreshold(%i) against health bands matches the independently-computed band",
    (score) => {
      expect(evaluateThreshold(score, healthBands)).toBe(expectedHealthBand(score));
    },
  );
});

describe("evaluateThreshold — full integer sweep against the default risk bands", () => {
  const riskBands = [
    { label: "critical", min: 80 },
    { label: "high", min: 60 },
    { label: "moderate", min: 30 },
    { label: "low", min: 0 },
  ];

  function expectedRiskBand(score: number): string {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 30) return "moderate";
    return "low";
  }

  it.each(Array.from({ length: 101 }, (_, score) => score))(
    "evaluateThreshold(%i) against risk bands matches the independently-computed band",
    (score) => {
      expect(evaluateThreshold(score, riskBands)).toBe(expectedRiskBand(score));
    },
  );
});

describe("computeCompositeScore", () => {
  it("computes and rounds the composite score to 2 decimal places", () => {
    const result = computeCompositeScore([
      { name: "a", value: 33.333, weight: 1 },
      { name: "b", value: 66.666, weight: 2 },
    ]);
    // (33.333*1 + 66.666*2) / 3 = (33.333+133.332)/3 = 166.665/3 = 55.555 -> rounds to 55.56
    expect(result).toBeCloseTo(55.56, 2);
  });
});
