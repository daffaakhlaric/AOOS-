import { describe, expect, it } from "vitest";

import { evaluateFatigue } from "./fatigue.js";

describe("evaluateFatigue", () => {
  it("returns FATIGUED when frequency > 3.5 AND a confirmed CTR drop >= 15%", () => {
    const result = evaluateFatigue({ frequencyCurrent: 4.1, ctrTrend: -0.22 });
    expect(result.status).toBe("FATIGUED");
    expect(result.reasoning).toContain("4.1");
    expect(result.reasoning).toContain("22%");
  });

  it("does NOT return FATIGUED when ctrTrend is undefined, even with high frequency — honest degrade, never a fabricated trend", () => {
    const result = evaluateFatigue({ frequencyCurrent: 4.1, ctrTrend: undefined });
    expect(result.status).not.toBe("FATIGUED");
    expect(result.status).toBe("WARNING");
    expect(result.reasoning).not.toContain("%");
    expect(result.reasoning.toLowerCase()).toContain("belum tersedia");
  });

  it("returns WARNING when frequency > 2.8 with no CTR trend data (honest frequency-only degrade)", () => {
    const result = evaluateFatigue({ frequencyCurrent: 3.0, ctrTrend: undefined });
    expect(result.status).toBe("WARNING");
  });

  it("returns WARNING when frequency > 2.8 AND a confirmed CTR drop >= 8% (but below FATIGUED thresholds)", () => {
    const result = evaluateFatigue({ frequencyCurrent: 3.0, ctrTrend: -0.1 });
    expect(result.status).toBe("WARNING");
  });

  it("returns NORMAL when frequency is at or below 2.8 regardless of CTR trend", () => {
    expect(evaluateFatigue({ frequencyCurrent: 2.0, ctrTrend: -0.5 }).status).toBe("NORMAL");
    expect(evaluateFatigue({ frequencyCurrent: 2.8, ctrTrend: undefined }).status).toBe("NORMAL");
  });

  it("returns NORMAL for a high frequency with a confirmed CTR trend that is not actually a meaningful drop", () => {
    const result = evaluateFatigue({ frequencyCurrent: 4.0, ctrTrend: 0.05 });
    expect(result.status).toBe("NORMAL");
  });

  it("boundary: exactly at FATIGUED thresholds does not fire (strict > / <=  as documented)", () => {
    // frequency must be STRICTLY greater than 3.5
    expect(evaluateFatigue({ frequencyCurrent: 3.5, ctrTrend: -0.5 }).status).not.toBe("FATIGUED");
  });
});
