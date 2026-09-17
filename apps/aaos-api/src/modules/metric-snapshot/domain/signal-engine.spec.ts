import { describe, expect, it } from "vitest";

import type { MetricSnapshotDto } from "../dto/metric-snapshot.dto.js";

import type { DataSufficiencyResult } from "./data-sufficiency.js";
import { detectSignals, type SignalDetectionInput } from "./signal-engine.js";

function makeSnapshot(overrides: Partial<MetricSnapshotDto> = {}): MetricSnapshotDto {
  return {
    window: "last_7_days",
    spend: 1_000_000,
    impressions: 25_000,
    clicks: 500,
    reach: 20_000,
    leads: 20,
    ctr: 0.02,
    cpm: 40_000,
    cpc: 2_000,
    cpl: 50_000,
    frequency: 1.25,
    sampleSize: { impressions: 25_000, clicks: 500, leads: 20 },
    daysCovered: 7,
    dataSufficiency: { level: "HIGH", score: 100, reasons: [] },
    ...overrides,
  };
}

function makeSufficiency(overrides: Partial<DataSufficiencyResult> = {}): DataSufficiencyResult {
  return { level: "HIGH", score: 90, reasons: [], ...overrides };
}

function makeInput(overrides: Partial<SignalDetectionInput> = {}): SignalDetectionInput {
  return {
    current: makeSnapshot(),
    previous: makeSnapshot(),
    dataSufficiency: makeSufficiency(),
    ...overrides,
  };
}

describe("detectSignals", () => {
  it("INSUFFICIENT short-circuit: returns only a single INSUFFICIENT_DATA signal, skipping every other detector", () => {
    const signals = detectSignals(
      makeInput({
        current: makeSnapshot({ ctr: 0.001, cpl: 500_000, spend: 100_000, leads: 0 }),
        previous: makeSnapshot({ ctr: 0.02, cpl: 50_000 }),
        dataSufficiency: makeSufficiency({
          level: "INSUFFICIENT",
          score: 5,
          reasons: ["Impressions baru 500."],
        }),
      }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]?.type).toBe("INSUFFICIENT_DATA");
    expect(signals[0]?.reasoning).toBe("Impressions baru 500.");
  });

  it("returns [] for a healthy account with no meaningful deltas", () => {
    const signals = detectSignals(
      makeInput({
        current: makeSnapshot({ ctr: 0.021, cpl: 49_000, frequency: 1.26, leads: 20 }),
        previous: makeSnapshot({ ctr: 0.02, cpl: 50_000, frequency: 1.25 }),
      }),
    );
    expect(signals).toEqual([]);
  });

  describe("CTR_DROP / CTR_IMPROVEMENT", () => {
    it("fires CTR_DROP at a relative drop past the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ ctr: 0.016 }), // (0.016-0.02)/0.02 = -20%
          previous: makeSnapshot({ ctr: 0.02 }),
        }),
      );
      expect(signals.some((s) => s.type === "CTR_DROP")).toBe(true);
    });

    it("does not fire CTR_DROP below the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ ctr: 0.018 }), // -10%
          previous: makeSnapshot({ ctr: 0.02 }),
        }),
      );
      expect(signals.some((s) => s.type === "CTR_DROP")).toBe(false);
    });

    it("fires CTR_IMPROVEMENT at a relative rise past the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ ctr: 0.024 }), // +20%
          previous: makeSnapshot({ ctr: 0.02 }),
        }),
      );
      expect(signals.some((s) => s.type === "CTR_IMPROVEMENT")).toBe(true);
    });
  });

  describe("CPL_SPIKE / CPL_IMPROVEMENT", () => {
    it("fires CPL_SPIKE at a relative rise past the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ cpl: 60_000 }), // +20%
          previous: makeSnapshot({ cpl: 50_000 }),
        }),
      );
      expect(signals.some((s) => s.type === "CPL_SPIKE")).toBe(true);
    });

    it("does not fire CPL_SPIKE below the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ cpl: 55_000 }), // +10%
          previous: makeSnapshot({ cpl: 50_000 }),
        }),
      );
      expect(signals.some((s) => s.type === "CPL_SPIKE")).toBe(false);
    });

    it("fires CPL_IMPROVEMENT at a relative drop past the 15% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ cpl: 40_000 }), // -20%
          previous: makeSnapshot({ cpl: 50_000 }),
        }),
      );
      expect(signals.some((s) => s.type === "CPL_IMPROVEMENT")).toBe(true);
    });
  });

  describe("FREQUENCY_RISE", () => {
    it("fires at a relative rise past the 8% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ frequency: 1.375 }), // (1.375-1.25)/1.25 = 10%
          previous: makeSnapshot({ frequency: 1.25 }),
        }),
      );
      expect(signals.some((s) => s.type === "FREQUENCY_RISE")).toBe(true);
    });

    it("does not fire below the 8% threshold", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ frequency: 1.3 }), // 4%
          previous: makeSnapshot({ frequency: 1.25 }),
        }),
      );
      expect(signals.some((s) => s.type === "FREQUENCY_RISE")).toBe(false);
    });
  });

  describe("SPEND_WITHOUT_RESULT", () => {
    it("fires when spend > 0 and leads === 0, with at least LOW data sufficiency", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ spend: 500_000, leads: 0 }),
          previous: makeSnapshot({ leads: 0, spend: 500_000 }),
          dataSufficiency: makeSufficiency({ level: "LOW" }),
        }),
      );
      expect(signals.some((s) => s.type === "SPEND_WITHOUT_RESULT")).toBe(true);
    });

    it("does not fire when leads > 0", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ spend: 500_000, leads: 3 }),
        }),
      );
      expect(signals.some((s) => s.type === "SPEND_WITHOUT_RESULT")).toBe(false);
    });

    it("does not fire when spend is 0", () => {
      const signals = detectSignals(
        makeInput({
          current: makeSnapshot({ spend: 0, leads: 0 }),
        }),
      );
      expect(signals.some((s) => s.type === "SPEND_WITHOUT_RESULT")).toBe(false);
    });
  });

  describe("CREATIVE_FATIGUE", () => {
    it("is skipped entirely when frequencyForFatigue is not provided", () => {
      const signals = detectSignals(makeInput());
      expect(signals.some((s) => s.type === "CREATIVE_FATIGUE")).toBe(false);
    });

    it("delegates to evaluateFatigue and maps FATIGUED to a HIGH-severity signal", () => {
      const signals = detectSignals(
        makeInput({
          frequencyForFatigue: 4.0,
          ctrTrendForFatigue: -0.2,
        }),
      );
      const fatigueSignal = signals.find((s) => s.type === "CREATIVE_FATIGUE");
      expect(fatigueSignal).toBeDefined();
      expect(fatigueSignal?.severity).toBe("HIGH");
    });

    it("maps WARNING to a MEDIUM-severity signal", () => {
      const signals = detectSignals(
        makeInput({
          frequencyForFatigue: 3.0,
        }),
      );
      const fatigueSignal = signals.find((s) => s.type === "CREATIVE_FATIGUE");
      expect(fatigueSignal).toBeDefined();
      expect(fatigueSignal?.severity).toBe("MEDIUM");
    });

    it("produces no CREATIVE_FATIGUE signal when evaluateFatigue returns NORMAL", () => {
      const signals = detectSignals(
        makeInput({
          frequencyForFatigue: 1.0,
        }),
      );
      expect(signals.some((s) => s.type === "CREATIVE_FATIGUE")).toBe(false);
    });
  });

  it("multiple signals can fire together", () => {
    const signals = detectSignals(
      makeInput({
        current: makeSnapshot({
          ctr: 0.016,
          cpl: 60_000,
          frequency: 1.375,
          spend: 500_000,
          leads: 0,
        }),
        previous: makeSnapshot({ ctr: 0.02, cpl: 50_000, frequency: 1.25 }),
        frequencyForFatigue: 4.0,
        ctrTrendForFatigue: -0.2,
      }),
    );
    const types = signals.map((s) => s.type).sort();
    expect(types).toEqual(
      [
        "CPL_SPIKE",
        "CREATIVE_FATIGUE",
        "CTR_DROP",
        "FREQUENCY_RISE",
        "SPEND_WITHOUT_RESULT",
      ].sort(),
    );
  });

  it("every signal's confidence derives from dataSufficiency.score (0-1)", () => {
    const signals = detectSignals(
      makeInput({
        current: makeSnapshot({ ctr: 0.016 }),
        previous: makeSnapshot({ ctr: 0.02 }),
        dataSufficiency: makeSufficiency({ level: "MEDIUM", score: 65 }),
      }),
    );
    const ctrSignal = signals.find((s) => s.type === "CTR_DROP");
    expect(ctrSignal?.confidence).toBeCloseTo(0.65);
  });
});
