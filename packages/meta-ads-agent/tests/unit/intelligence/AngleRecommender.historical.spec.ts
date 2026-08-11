import { Branch, Funnel } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AgentMemory } from "../../../src/domain/entities/AgentMemory.js";
import { AdAngle } from "../../../src/domain/value-objects/AdAngle.js";
import { performanceBaselineKey } from "../../../src/domain/value-objects/PerformanceBaseline.js";
import { createSeasonalPattern } from "../../../src/domain/value-objects/SeasonalPattern.js";
import { AngleRecommender } from "../../../src/intelligence/AngleRecommender.js";

function memoryWithBaseline(input: {
  readonly branch: Branch;
  readonly angle: AdAngle;
  readonly sampleSize: number;
  readonly topAngles: readonly AdAngle[];
}): AgentMemory {
  const memory = new AgentMemory();
  const key = performanceBaselineKey(input.branch, Funnel.CTWA, input.angle);
  memory.seedHistoricalLearnings({
    performanceBaselines: new Map([
      [
        key,
        {
          branch: input.branch,
          funnel: Funnel.CTWA,
          angle: input.angle,
          avgRphLead: 7_000,
          sampleSize: input.sampleSize,
        },
      ],
    ]),
    evergreenAdIds: [],
    fatiguePatterns: new Map(),
    seasonalPatterns: createSeasonalPattern([]),
    topAngles: input.topAngles,
  });
  return memory;
}

describe("AngleRecommender.selectBestAngle — 3-tier logic (AAOS-W1D-S1S2 S1)", () => {
  it("tier 1: uses historical ranking when a topAngles entry has sampleSize >= 20", () => {
    const memory = memoryWithBaseline({
      branch: Branch.CINERE,
      angle: AdAngle.QNA,
      sampleSize: 25,
      topAngles: [AdAngle.QNA],
    });

    // Static ranking for Xpander/Cinere would pick GUDANGNYA — historical QNA must win instead.
    expect(AngleRecommender.selectBestAngle(Branch.CINERE, "Xpander Cross 2019", memory)).toBe(
      AdAngle.QNA,
    );
  });

  it("tier 1 is skipped when sampleSize < 20, falling through to tier 2", () => {
    const memory = memoryWithBaseline({
      branch: Branch.CINERE,
      angle: AdAngle.QNA,
      sampleSize: 19,
      topAngles: [AdAngle.QNA],
    });

    expect(AngleRecommender.selectBestAngle(Branch.CINERE, "Xpander Cross 2019", memory)).toBe(
      AdAngle.GUDANGNYA, // TOP_UNITS Xpander.bestAngles[0]
    );
  });

  it("tier 2: falls back to TOP_UNITS unit-specific bestAngles[0] when no historical match exists", () => {
    const memory = new AgentMemory();
    expect(AngleRecommender.selectBestAngle(Branch.CINERE, "Xpander Cross 2019", memory)).toBe(
      AdAngle.GUDANGNYA,
    );
  });

  it("tier 2 matches case-insensitively on unit name substring", () => {
    const memory = new AgentMemory();
    expect(AngleRecommender.selectBestAngle(Branch.BINTARO, "brio satya 2020", memory)).toBe(
      AdAngle.DP_RINGAN, // TOP_UNITS Brio.bestAngles[0]
    );
  });

  it("tier 3: falls back to DP_RINGAN when no memory and no TOP_UNITS match", () => {
    expect(AngleRecommender.selectBestAngle(Branch.BANDUNG, "Unknown Model 2021")).toBe(
      AdAngle.DP_RINGAN,
    );
  });

  it("tier 3: falls back to DP_RINGAN when memory has no usable baseline and unit is unrecognized", () => {
    const memory = new AgentMemory();
    expect(AngleRecommender.selectBestAngle(Branch.BANDUNG, "Unknown Model 2021", memory)).toBe(
      AdAngle.DP_RINGAN,
    );
  });

  it("iterates topAngles in order, skipping entries below the sample threshold", () => {
    const memory = new AgentMemory();
    const key1 = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.QNA);
    const key2 = performanceBaselineKey(Branch.CINERE, Funnel.CTWA, AdAngle.TESTIMONIAL);
    memory.seedHistoricalLearnings({
      performanceBaselines: new Map([
        [
          key1,
          {
            branch: Branch.CINERE,
            funnel: Funnel.CTWA,
            angle: AdAngle.QNA,
            avgRphLead: 7000,
            sampleSize: 5,
          },
        ],
        [
          key2,
          {
            branch: Branch.CINERE,
            funnel: Funnel.CTWA,
            angle: AdAngle.TESTIMONIAL,
            avgRphLead: 7000,
            sampleSize: 30,
          },
        ],
      ]),
      evergreenAdIds: [],
      fatiguePatterns: new Map(),
      seasonalPatterns: createSeasonalPattern([]),
      topAngles: [AdAngle.QNA, AdAngle.TESTIMONIAL],
    });

    expect(AngleRecommender.selectBestAngle(Branch.CINERE, "Xpander Cross 2019", memory)).toBe(
      AdAngle.TESTIMONIAL,
    );
  });
});
