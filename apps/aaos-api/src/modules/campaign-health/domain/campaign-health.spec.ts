import { describe, expect, it } from "vitest";

import type { BenchmarkResult } from "../../metric-snapshot/domain/benchmark.js";
import type { SamanthaSignal } from "../../metric-snapshot/domain/signal-engine.js";
import type { MetricSnapshotDto } from "../../metric-snapshot/dto/metric-snapshot.dto.js";

import { assessCampaignHealth, type CampaignHealthInput } from "./campaign-health.js";

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

function makeBenchmark(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    source: "CAMPAIGN_HISTORICAL",
    cpl: 50_000,
    ctr: 0.02,
    confidence: "HIGH",
    ...overrides,
  };
}

function makeSignal(overrides: Partial<SamanthaSignal> = {}): SamanthaSignal {
  return {
    type: "CTR_DROP",
    severity: "MEDIUM",
    confidence: 0.9,
    reasoning: "reasoning",
    ...overrides,
  };
}

function makeInput(overrides: Partial<CampaignHealthInput> = {}): CampaignHealthInput {
  return {
    current: makeSnapshot(),
    signals: [],
    benchmark: makeBenchmark(),
    frequencyDataAvailable: true,
    ...overrides,
  };
}

describe("assessCampaignHealth", () => {
  describe("delivery", () => {
    it("is UNKNOWN when dataSufficiency is INSUFFICIENT", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({
            dataSufficiency: { level: "INSUFFICIENT", score: 5, reasons: ["not enough"] },
          }),
        }),
      );
      expect(health.delivery.status).toBe("UNKNOWN");
      expect(health.delivery.score).toBeUndefined();
      expect(health.delivery.confidence).toBe(0);
      expect(health.delivery.issues).not.toEqual([]);
    });

    it("is CRITICAL when a SPEND_WITHOUT_RESULT signal is present", () => {
      const health = assessCampaignHealth(
        makeInput({
          signals: [makeSignal({ type: "SPEND_WITHOUT_RESULT", severity: "HIGH" })],
        }),
      );
      expect(health.delivery.status).toBe("CRITICAL");
      expect(health.delivery.score).toBe(100);
    });

    it("is WATCH when dataSufficiency is LOW", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ dataSufficiency: { level: "LOW", score: 40, reasons: ["low"] } }),
        }),
      );
      expect(health.delivery.status).toBe("WATCH");
      expect(health.delivery.score).toBe(40);
    });

    it("is HEALTHY at MEDIUM/HIGH sufficiency with no SPEND_WITHOUT_RESULT signal", () => {
      const healthMedium = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ dataSufficiency: { level: "MEDIUM", score: 70, reasons: [] } }),
        }),
      );
      expect(healthMedium.delivery.status).toBe("HEALTHY");
      expect(healthMedium.delivery.issues).toEqual([]);

      const healthHigh = assessCampaignHealth(makeInput());
      expect(healthHigh.delivery.status).toBe("HEALTHY");
    });
  });

  describe("costEfficiency", () => {
    it("is UNKNOWN when benchmark.confidence is NONE", () => {
      const health = assessCampaignHealth(
        makeInput({ benchmark: { source: "NONE", confidence: "NONE" } }),
      );
      expect(health.costEfficiency.status).toBe("UNKNOWN");
      expect(health.costEfficiency.score).toBeUndefined();
    });

    it("is UNKNOWN when current.cpl is undefined even with a usable benchmark", () => {
      const health = assessCampaignHealth(
        makeInput({ current: makeSnapshot({ cpl: undefined, leads: 0 }) }),
      );
      expect(health.costEfficiency.status).toBe("UNKNOWN");
    });

    it("is HEALTHY within +15% of benchmark CPL", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 55_000 }), // +10%
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.costEfficiency.status).toBe("HEALTHY");
    });

    it("is WATCH between +15% and +40% over benchmark CPL", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 65_000 }), // +30%
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.costEfficiency.status).toBe("WATCH");
    });

    it("is WARNING between +40% and +80% over benchmark CPL", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 80_000 }), // +60%
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.costEfficiency.status).toBe("WARNING");
    });

    it("is CRITICAL beyond +80% over benchmark CPL", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 120_000 }), // +140%
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.costEfficiency.status).toBe("CRITICAL");
      expect(health.costEfficiency.score).toBe(0);
    });

    it("caps score at 100 when current CPL is cheaper than benchmark", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 20_000 }),
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.costEfficiency.score).toBe(100);
    });
  });

  describe("creative", () => {
    it("is UNKNOWN when frequencyDataAvailable is false", () => {
      const health = assessCampaignHealth(makeInput({ frequencyDataAvailable: false }));
      expect(health.creative.status).toBe("UNKNOWN");
      expect(health.creative.score).toBeUndefined();
    });

    it("is HEALTHY when frequency data is available and no CREATIVE_FATIGUE signal fired", () => {
      const health = assessCampaignHealth(makeInput({ frequencyDataAvailable: true, signals: [] }));
      expect(health.creative.status).toBe("HEALTHY");
      expect(health.creative.score).toBe(100);
    });

    it("is CRITICAL when a HIGH-severity CREATIVE_FATIGUE signal fired", () => {
      const health = assessCampaignHealth(
        makeInput({
          frequencyDataAvailable: true,
          signals: [
            makeSignal({ type: "CREATIVE_FATIGUE", severity: "HIGH", reasoning: "fatigued" }),
          ],
        }),
      );
      expect(health.creative.status).toBe("CRITICAL");
      expect(health.creative.issues).toEqual(["fatigued"]);
    });

    it("is WARNING when a MEDIUM-severity CREATIVE_FATIGUE signal fired", () => {
      const health = assessCampaignHealth(
        makeInput({
          frequencyDataAvailable: true,
          signals: [makeSignal({ type: "CREATIVE_FATIGUE", severity: "MEDIUM" })],
        }),
      );
      expect(health.creative.status).toBe("WARNING");
    });
  });

  describe("audience / tracking / leadQuality", () => {
    it("are always UNKNOWN with an honest, non-empty issue message", () => {
      const health = assessCampaignHealth(makeInput());
      for (const dimension of [health.audience, health.tracking, health.leadQuality]) {
        expect(dimension.status).toBe("UNKNOWN");
        expect(dimension.score).toBeUndefined();
        expect(dimension.confidence).toBe(0);
        expect(dimension.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("conversion", () => {
    it("is UNKNOWN when dataSufficiency is INSUFFICIENT", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({
            dataSufficiency: { level: "INSUFFICIENT", score: 5, reasons: ["low"] },
          }),
        }),
      );
      expect(health.conversion.status).toBe("UNKNOWN");
    });

    it("is CRITICAL when a HIGH-severity CTR_DROP signal fired", () => {
      const health = assessCampaignHealth(
        makeInput({ signals: [makeSignal({ type: "CTR_DROP", severity: "HIGH" })] }),
      );
      expect(health.conversion.status).toBe("CRITICAL");
    });

    it("is WARNING when a MEDIUM-severity CTR_DROP signal fired", () => {
      const health = assessCampaignHealth(
        makeInput({ signals: [makeSignal({ type: "CTR_DROP", severity: "MEDIUM" })] }),
      );
      expect(health.conversion.status).toBe("WARNING");
    });

    it("is HEALTHY when a CTR_IMPROVEMENT signal fired", () => {
      const health = assessCampaignHealth(
        makeInput({ signals: [makeSignal({ type: "CTR_IMPROVEMENT", severity: "INFO" })] }),
      );
      expect(health.conversion.status).toBe("HEALTHY");
    });

    it("is HEALTHY when no CTR signal fired at all and sufficiency is at least LOW", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ dataSufficiency: { level: "LOW", score: 40, reasons: [] } }),
          signals: [],
        }),
      );
      expect(health.conversion.status).toBe("HEALTHY");
    });
  });

  describe("overallStatus rollup", () => {
    it("is the worst real status across dimensions, ignoring UNKNOWN", () => {
      // delivery HEALTHY, costEfficiency WATCH (+30%), creative HEALTHY, conversion HEALTHY,
      // audience/tracking/leadQuality always UNKNOWN.
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({ cpl: 65_000 }),
          benchmark: makeBenchmark({ cpl: 50_000 }),
        }),
      );
      expect(health.overallStatus).toBe("WATCH");
    });

    it("picks CRITICAL over WARNING/WATCH/HEALTHY when any real dimension is CRITICAL", () => {
      const health = assessCampaignHealth(
        makeInput({
          signals: [makeSignal({ type: "SPEND_WITHOUT_RESULT", severity: "HIGH" })],
        }),
      );
      expect(health.overallStatus).toBe("CRITICAL");
    });

    it("is honestly UNKNOWN when all 7 dimensions are UNKNOWN", () => {
      const health = assessCampaignHealth(
        makeInput({
          current: makeSnapshot({
            dataSufficiency: { level: "INSUFFICIENT", score: 5, reasons: ["low"] },
          }),
          benchmark: { source: "NONE", confidence: "NONE" },
          frequencyDataAvailable: false,
        }),
      );
      expect(health.delivery.status).toBe("UNKNOWN");
      expect(health.costEfficiency.status).toBe("UNKNOWN");
      expect(health.creative.status).toBe("UNKNOWN");
      expect(health.conversion.status).toBe("UNKNOWN");
      expect(health.overallStatus).toBe("UNKNOWN");
    });
  });
});
