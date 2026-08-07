import { PipelineStageFailureException } from "../errors/pipeline-stage-failure-exception.js";
import { KnowledgeAnalyticsEventType } from "../events/knowledge-analytics-event-type.js";
import { generateId } from "../utils/id-generator.js";

import type { PipelineContext, PipelineStage } from "./pipeline-stage.js";
import { AggregateMetricsStage } from "./stages/aggregate-metrics-stage.js";
import { CalculateKPIsStage } from "./stages/calculate-kpis-stage.js";
import { CollectMetricsStage } from "./stages/collect-metrics-stage.js";
import { GenerateDashboardSnapshotStage } from "./stages/generate-dashboard-snapshot-stage.js";
import { GenerateReportsStage } from "./stages/generate-reports-stage.js";
import { PublishEventsStage } from "./stages/publish-events-stage.js";

/** Everything a `KnowledgeAnalyticsPipeline` run needs, minus the `runId` (generated per run). */
export type PipelineRunInput = Omit<PipelineContext, "runId">;

/**
 * Real sequential 6-stage analytics flow: Collect Metrics → Aggregate Metrics → Calculate KPIs →
 * Generate Reports → Generate Dashboard Snapshot → Publish Events.
 *
 * The pipeline itself (not stage 6) publishes `AnalyticsStarted` before stage 1 runs and either
 * `AnalyticsCompleted` (all 6 stages succeeded) or `AnalyticsFailed` (any stage threw) after the
 * last stage — these two events bracket the whole run, while stage 6 fires the finer-grained
 * `MetricCalculated` / `ReportGenerated` / `DashboardUpdated` events for what was produced.
 */
export class KnowledgeAnalyticsPipeline {
  private readonly stages: readonly PipelineStage[];

  constructor(stages?: readonly PipelineStage[]) {
    this.stages = stages ?? [
      new CollectMetricsStage(),
      new AggregateMetricsStage(),
      new CalculateKPIsStage(),
      new GenerateReportsStage(),
      new GenerateDashboardSnapshotStage(),
      new PublishEventsStage(),
    ];
  }

  run(input: PipelineRunInput): PipelineContext {
    const runId = generateId("run");
    let context: PipelineContext = { ...input, runId };

    context.eventPublisher.publish(KnowledgeAnalyticsEventType.AnalyticsStarted, { runId });

    let currentStageName = "unknown";
    try {
      for (const stage of this.stages) {
        currentStageName = stage.name;
        context = stage.execute(context);
      }
    } catch (error) {
      context.statistics.recordPipelineRunFailed();
      context.eventPublisher.publish(KnowledgeAnalyticsEventType.AnalyticsFailed, {
        runId,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw new PipelineStageFailureException(currentStageName, error);
    }

    context.statistics.recordPipelineRunCompleted();
    context.eventPublisher.publish(KnowledgeAnalyticsEventType.AnalyticsCompleted, { runId });

    return context;
  }
}
