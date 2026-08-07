import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeCoverageStage } from "../../../src/pipeline/stages/analyze-coverage-stage.js";
import { AnalyzeSimilarityStage } from "../../../src/pipeline/stages/analyze-similarity-stage.js";
import { GenerateRecommendationsStage } from "../../../src/pipeline/stages/generate-recommendations-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("GenerateRecommendationsStage", () => {
  beforeEach(() => resetFixtureState());

  it("generates recommendations, a health report, and insights", () => {
    const clock = makeClock(1000);
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength: 500 })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeSimilarityStage().execute(context);
    new AnalyzeCoverageStage().execute(context);
    new GenerateRecommendationsStage().execute(context);

    expect(context.recommendations).toBeDefined();
    expect(context.healthReport).toBeDefined();
    expect(context.healthReport?.itemScores).toHaveLength(1);
    expect(context.insights?.length).toBeGreaterThan(0);
  });

  it("falls back to defaults when coverage/similarity/gap stages did not run first", () => {
    const clock = makeClock(1000);
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength: 500 })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new GenerateRecommendationsStage().execute(context);
    expect(context.healthReport?.overallScore.coverage).toBe(100);
    expect(context.insights).toBeDefined();
  });

  it("defaults per-signal averages to 100 for an empty item set (no signals to average)", () => {
    const clock = makeClock(1000);
    const context: PipelineContext = {
      items: [],
      runId: "r",
      ...makeServices(clock, makeConfig()),
    };
    new GenerateRecommendationsStage().execute(context);
    expect(context.healthReport?.overallScore.quality).toBe(100);
    expect(context.healthReport?.overallScore.freshness).toBe(100);
    expect(context.healthReport?.overallScore.risk).toBe(100);
  });
});
