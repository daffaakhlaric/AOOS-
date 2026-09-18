import { describe, expect, it } from "vitest";

import { computeObjectiveProgress, type ObjectiveProgressInput } from "./objective-progress.js";

const BASE: ObjectiveProgressInput = {
  targetHotLeads: 50,
  achievedHotLeads: 25,
  startDate: "2026-01-01",
  endDate: "2026-01-11", // inclusive 11-day window
  today: new Date("2026-01-06T00:00:00.000Z"), // 5 days elapsed, 5 remaining
};

describe("computeObjectiveProgress", () => {
  it("COMPLETED when achievedHotLeads exactly equals targetHotLeads", () => {
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 50 });
    expect(result.status).toBe("COMPLETED");
    expect(result.progressPct).toBe(1);
    expect(result.requiredDailyPace).toBeUndefined();
  });

  it("COMPLETED when achievedHotLeads is above targetHotLeads", () => {
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 70 });
    expect(result.status).toBe("COMPLETED");
    expect(result.progressPct).toBeCloseTo(1.4, 5);
    expect(result.requiredDailyPace).toBeUndefined();
  });

  it("COMPLETED takes priority over an expired window (target hit before endDate)", () => {
    const result = computeObjectiveProgress({
      ...BASE,
      achievedHotLeads: 50,
      today: new Date("2026-02-01T00:00:00.000Z"), // well past endDate
    });
    expect(result.status).toBe("COMPLETED");
  });

  it("OFF_TRACK when the window has ended (daysRemaining = 0) without reaching target", () => {
    const result = computeObjectiveProgress({
      ...BASE,
      achievedHotLeads: 30,
      today: new Date("2026-02-01T00:00:00.000Z"),
    });
    expect(result.daysRemaining).toBe(0);
    expect(result.status).toBe("OFF_TRACK");
    expect(result.requiredDailyPace).toBeUndefined();
  });

  it("ON_TRACK when projectedFinalCount / targetHotLeads >= 0.9", () => {
    // daysElapsed=5, achieved=41 -> currentDailyPace=8.2, projected = 8.2*11 = 90.2 -> ratio 0.902
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 41 });
    expect(result.daysElapsed).toBe(5);
    expect(result.currentDailyPace).toBeCloseTo(8.2, 5);
    expect(result.projectedFinalCount).toBeCloseTo(90.2, 5);
    expect(result.status).toBe("ON_TRACK");
  });

  it("AT_RISK when projectedFinalCount / targetHotLeads is in [0.5, 0.9)", () => {
    // achieved=25 -> currentDailyPace=5, projected = 5*11 = 55 -> ratio 1.1... too high; pick a
    // value that lands in-band: achieved=20 -> pace=4, projected=44 -> ratio 0.88 (still ON_TRACK).
    // achieved=15 -> pace=3, projected=33 -> ratio 0.66 -> AT_RISK.
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 15 });
    expect(result.currentDailyPace).toBeCloseTo(3, 5);
    expect(result.projectedFinalCount).toBeCloseTo(33, 5);
    expect(result.projectedFinalCount / BASE.targetHotLeads).toBeCloseTo(0.66, 2);
    expect(result.status).toBe("AT_RISK");
  });

  it("OFF_TRACK when projectedFinalCount / targetHotLeads < 0.5 and window still open", () => {
    // achieved=5 -> pace=1, projected=11 -> ratio 0.22
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 5 });
    expect(result.currentDailyPace).toBeCloseTo(1, 5);
    expect(result.projectedFinalCount).toBeCloseTo(11, 5);
    expect(result.status).toBe("OFF_TRACK");
    expect(result.requiredDailyPace).toBeCloseTo((50 - 5) / 5, 5);
  });

  it("boundary: projection ratio exactly 0.9 is ON_TRACK (>=)", () => {
    // Need projectedFinalCount / target == 0.9 exactly: target=50 -> projected=45 -> pace=45/11
    // -> achieved = pace * daysElapsed = (45/11)*5
    const achieved = (45 / 11) * 5;
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: achieved });
    expect(result.projectedFinalCount / BASE.targetHotLeads).toBeCloseTo(0.9, 5);
    expect(result.status).toBe("ON_TRACK");
  });

  it("boundary: projection ratio exactly 0.5 is AT_RISK (>=)", () => {
    const achieved = (25 / 11) * 5;
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: achieved });
    expect(result.projectedFinalCount / BASE.targetHotLeads).toBeCloseTo(0.5, 5);
    expect(result.status).toBe("AT_RISK");
  });

  it("today before startDate: daysElapsed clamps to 0, currentDailyPace = achievedHotLeads, no NaN/divide-by-zero", () => {
    const result = computeObjectiveProgress({
      ...BASE,
      achievedHotLeads: 0,
      today: new Date("2025-12-25T00:00:00.000Z"),
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.currentDailyPace).toBe(0);
    expect(result.projectedFinalCount).toBe(0);
    expect(Number.isNaN(result.projectedFinalCount)).toBe(false);
    expect(result.status).toBe("OFF_TRACK"); // ratio 0 < 0.5
    expect(result.daysRemaining).toBe(11);
    expect(result.requiredDailyPace).toBeCloseTo(50 / 11, 5);
  });

  it("today before startDate but achievedHotLeads already >= target: still COMPLETED (rule 1 first)", () => {
    const result = computeObjectiveProgress({
      ...BASE,
      achievedHotLeads: 50,
      today: new Date("2025-12-25T00:00:00.000Z"),
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.status).toBe("COMPLETED");
  });

  it("same-day startDate === endDate window: totalWindowDays clamps to 1", () => {
    const result = computeObjectiveProgress({
      targetHotLeads: 10,
      achievedHotLeads: 4,
      startDate: "2026-03-01",
      endDate: "2026-03-01",
      today: new Date("2026-03-01T00:00:00.000Z"),
    });
    // Same "start day itself counts as 0 elapsed" convention `pacing.ts`'s own daysElapsed math
    // uses: `today == startDate` -> `todayMs - startMs == 0`.
    expect(result.daysElapsed).toBe(0);
    expect(result.daysRemaining).toBe(0);
    expect(result.currentDailyPace).toBe(4);
    expect(result.projectedFinalCount).toBe(4); // 4 * totalWindowDays(1)
    expect(result.status).toBe("OFF_TRACK"); // window ended, target not reached
    expect(result.requiredDailyPace).toBeUndefined();
  });

  it("requiredDailyPace is undefined once target is already reached even with daysRemaining > 0", () => {
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 60 });
    expect(result.daysRemaining).toBe(5);
    expect(result.requiredDailyPace).toBeUndefined();
  });

  it("echoes progressPct as a real, always-computable ratio (never undefined)", () => {
    const result = computeObjectiveProgress({ ...BASE, achievedHotLeads: 0 });
    expect(result.progressPct).toBe(0);
  });
});
