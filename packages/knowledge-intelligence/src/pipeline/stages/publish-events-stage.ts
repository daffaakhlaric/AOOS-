import { KnowledgeIntelligenceEventType } from "../../events/knowledge-intelligence-event-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 11: publishes the domain events describing everything the pipeline discovered. */
export class PublishEventsStage implements PipelineStage {
  readonly name = "publish-events";

  execute(context: PipelineContext): PipelineContext {
    const Event = KnowledgeIntelligenceEventType;

    context.eventPublisher.publish(Event.KnowledgeAnalyzed, {
      runId: context.runId,
      itemCount: context.items.length,
      findingsCount: context.findings?.length ?? 0,
    });

    for (const insight of context.insights ?? []) {
      context.eventPublisher.publish(Event.InsightGenerated, {
        runId: context.runId,
        insightId: insight.id,
      });
    }

    for (const recommendation of context.recommendations ?? []) {
      context.eventPublisher.publish(Event.RecommendationGenerated, {
        runId: context.runId,
        recommendationId: recommendation.id,
        type: recommendation.type,
      });
    }

    for (const gap of context.gapReport?.gaps ?? []) {
      context.eventPublisher.publish(Event.GapDetected, { runId: context.runId, topic: gap.topic });
    }

    for (const duplicate of context.duplicates ?? []) {
      context.eventPublisher.publish(Event.DuplicateDetected, {
        runId: context.runId,
        itemAId: duplicate.itemAId,
        itemBId: duplicate.itemBId,
      });
    }

    for (const entry of context.similarityMatrix?.entries ?? []) {
      context.eventPublisher.publish(Event.SimilarityDetected, {
        runId: context.runId,
        itemAId: entry.itemAId,
        itemBId: entry.itemBId,
        classification: entry.classification,
      });
    }

    for (const relationship of context.relationships ?? []) {
      context.eventPublisher.publish(Event.RelationshipDiscovered, {
        runId: context.runId,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
      });
    }

    if (context.healthReport) {
      context.eventPublisher.publish(Event.HealthCalculated, {
        runId: context.runId,
        overall: context.healthReport.overallScore.overall,
        status: context.healthReport.overallScore.status,
      });
    }

    for (const [itemId, score] of context.qualityScores ?? new Map()) {
      context.eventPublisher.publish(Event.ScoreCalculated, {
        runId: context.runId,
        itemId,
        score: score.value,
      });
    }

    if (context.report) {
      context.eventPublisher.publish(Event.ReportGenerated, {
        runId: context.runId,
        reportId: context.report.id,
        reportType: context.report.type,
      });
    }

    return context;
  }
}
