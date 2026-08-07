import { beforeEach, describe, expect, it } from "vitest";

import type { InMemoryEventPublisher } from "../../../src/events/in-memory-event-publisher.js";
import { KnowledgeIntelligenceEventType } from "../../../src/events/knowledge-intelligence-event-type.js";
import type { PipelineContext } from "../../../src/pipeline/pipeline-stage.js";
import { AnalyzeCoverageStage } from "../../../src/pipeline/stages/analyze-coverage-stage.js";
import { AnalyzeFreshnessStage } from "../../../src/pipeline/stages/analyze-freshness-stage.js";
import { AnalyzeQualityStage } from "../../../src/pipeline/stages/analyze-quality-stage.js";
import { AnalyzeRelationshipsStage } from "../../../src/pipeline/stages/analyze-relationships-stage.js";
import { AnalyzeRisksStage } from "../../../src/pipeline/stages/analyze-risks-stage.js";
import { AnalyzeSimilarityStage } from "../../../src/pipeline/stages/analyze-similarity-stage.js";
import { GenerateIntelligenceReportStage } from "../../../src/pipeline/stages/generate-intelligence-report-stage.js";
import { GenerateRecommendationsStage } from "../../../src/pipeline/stages/generate-recommendations-stage.js";
import { PublishEventsStage } from "../../../src/pipeline/stages/publish-events-stage.js";
import { resetFixtureState, makeClock, makeConfig, makeItem } from "../../helpers/fixtures.js";
import { makeServices } from "../../helpers/pipeline-helpers.js";

describe("PublishEventsStage", () => {
  beforeEach(() => resetFixtureState());

  it("publishes every applicable event type for a rich run", () => {
    const clock = makeClock(1000);
    const items = [
      makeItem({ id: "a", tags: ["x", "y"], lastUpdatedAt: 1000, contentLength: 500 }),
      makeItem({ id: "b", tags: ["x", "y"], lastUpdatedAt: 1000, contentLength: 500 }),
    ];
    const context: PipelineContext = {
      items,
      taxonomy: [{ topic: "gap-topic", covered: false, itemCount: 0 }],
      runId: "r",
      ...makeServices(clock, makeConfig()),
    };
    new AnalyzeRelationshipsStage().execute(context);
    new AnalyzeSimilarityStage().execute(context);
    new AnalyzeCoverageStage().execute(context);
    new AnalyzeQualityStage().execute(context);
    new AnalyzeFreshnessStage().execute(context);
    new AnalyzeRisksStage().execute(context);
    new GenerateRecommendationsStage().execute(context);
    new GenerateIntelligenceReportStage().execute(context);
    new PublishEventsStage().execute(context);

    const types = new Set(
      (context.eventPublisher as InMemoryEventPublisher).getHistory().map((e) => e.eventType),
    );
    expect(types).toContain(KnowledgeIntelligenceEventType.KnowledgeAnalyzed);
    expect(types).toContain(KnowledgeIntelligenceEventType.DuplicateDetected);
    expect(types).toContain(KnowledgeIntelligenceEventType.SimilarityDetected);
    expect(types).toContain(KnowledgeIntelligenceEventType.RelationshipDiscovered);
    expect(types).toContain(KnowledgeIntelligenceEventType.GapDetected);
    expect(types).toContain(KnowledgeIntelligenceEventType.HealthCalculated);
    expect(types).toContain(KnowledgeIntelligenceEventType.ScoreCalculated);
    expect(types).toContain(KnowledgeIntelligenceEventType.ReportGenerated);
  });

  it("does not publish InsightGenerated/RecommendationGenerated when there are none", () => {
    const clock = makeClock(1000);
    const items: ReturnType<typeof makeItem>[] = [];
    const context: PipelineContext = { items, runId: "r", ...makeServices(clock, makeConfig()) };
    context.insights = [];
    context.recommendations = [];
    new PublishEventsStage().execute(context);
    const types = (context.eventPublisher as InMemoryEventPublisher)
      .getHistory()
      .map((e) => e.eventType);
    expect(types).not.toContain(KnowledgeIntelligenceEventType.InsightGenerated);
    expect(types).not.toContain(KnowledgeIntelligenceEventType.RecommendationGenerated);
  });

  it("handles every optional context field being entirely unset (not merely empty)", () => {
    const clock = makeClock(1000);
    const context: PipelineContext = {
      items: [],
      runId: "r",
      ...makeServices(clock, makeConfig()),
    };
    expect(() => new PublishEventsStage().execute(context)).not.toThrow();
    const types = (context.eventPublisher as InMemoryEventPublisher)
      .getHistory()
      .map((e) => e.eventType);
    expect(types).toContain(KnowledgeIntelligenceEventType.KnowledgeAnalyzed);
    expect(types).not.toContain(KnowledgeIntelligenceEventType.ReportGenerated);
    expect(types).not.toContain(KnowledgeIntelligenceEventType.HealthCalculated);
  });
});
