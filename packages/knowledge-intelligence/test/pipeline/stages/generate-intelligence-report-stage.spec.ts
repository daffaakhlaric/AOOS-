import { beforeEach, describe, expect, it } from "vitest";

import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeCoverageStage } from "../../../src/pipeline/stages/analyze-coverage-stage.js";
import { AnalyzeFreshnessStage } from "../../../src/pipeline/stages/analyze-freshness-stage.js";
import { AnalyzeQualityStage } from "../../../src/pipeline/stages/analyze-quality-stage.js";
import { AnalyzeRisksStage } from "../../../src/pipeline/stages/analyze-risks-stage.js";
import { AnalyzeSimilarityStage } from "../../../src/pipeline/stages/analyze-similarity-stage.js";
import { GenerateIntelligenceReportStage } from "../../../src/pipeline/stages/generate-intelligence-report-stage.js";
import { GenerateRecommendationsStage } from "../../../src/pipeline/stages/generate-recommendations-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("GenerateIntelligenceReportStage", () => {
  beforeEach(() => resetFixtureState());

  it("assembles the report, registers it, and computes statistics", () => {
    const clock = makeClock(1000);
    const items = [makeItem({ id: "a", lastUpdatedAt: 1000, contentLength: 500 })];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    new AnalyzeSimilarityStage().execute(context);
    new AnalyzeCoverageStage().execute(context);
    new AnalyzeQualityStage().execute(context);
    new AnalyzeFreshnessStage().execute(context);
    new AnalyzeRisksStage().execute(context);
    new GenerateRecommendationsStage().execute(context);
    new GenerateIntelligenceReportStage().execute(context);

    expect(context.report).toBeDefined();
    expect(context.registry.getReport(context.report!.id)).toBe(context.report);
    expect(context.statistics?.itemsAnalyzed).toBe(1);
    expect(context.statistics?.averageQualityScore).toBeGreaterThan(0);
  });

  it("falls back to empty defaults when no prior stage populated the optional context fields", () => {
    const clock = makeClock(1000);
    const context: PipelineContext = {
      items: [],
      runId: "r",
      ...makeServices(clock, makeConfig()),
    };
    new GenerateIntelligenceReportStage().execute(context);
    expect(context.report?.sections.findings).toEqual([]);
    expect(context.report?.sections.relationships).toEqual([]);
    expect(context.report?.sections.duplicates).toEqual([]);
    expect(context.report?.sections.nearDuplicates).toEqual([]);
    expect(context.report?.sections.recommendations).toEqual([]);
    expect(context.report?.sections.insights).toEqual([]);
    expect(context.statistics?.findingsCount).toBe(0);
    expect(context.statistics?.gapsCount).toBe(0);
    expect(context.statistics?.orphansCount).toBe(0);
    expect(context.statistics?.averageHealthScore).toBe(0);
    expect(context.statistics?.averageQualityScore).toBe(0);
    expect(context.statistics?.averageFreshnessScore).toBe(0);
    expect(context.statistics?.averageRiskScore).toBe(0);
  });
});
