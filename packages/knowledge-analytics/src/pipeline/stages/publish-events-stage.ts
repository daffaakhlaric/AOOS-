import { InvalidSampleException } from "../../errors/invalid-sample-exception.js";
import { KnowledgeAnalyticsEventType } from "../../events/knowledge-analytics-event-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/**
 * Stage 6 — Publish Events: fires `MetricCalculated` for every numeric KPI, `ReportGenerated` for
 * every report produced by stage 4, and `DashboardUpdated` for the snapshot produced by stage 5.
 * (`AnalyticsStarted`/`AnalyticsCompleted`/`AnalyticsFailed` bracket the whole run and are
 * published by `KnowledgeAnalyticsPipeline` itself, not this stage — see its docs.)
 */
export class PublishEventsStage implements PipelineStage {
  readonly name = "PublishEvents";

  execute(context: PipelineContext): PipelineContext {
    if (!context.kpis || !context.reports || !context.dashboardSnapshot) {
      throw new InvalidSampleException(
        "PublishEvents ran before all prior stages populated their outputs",
      );
    }

    let published = 0;
    for (const [metricId, value] of Object.entries(context.kpis)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      context.eventPublisher.publish(KnowledgeAnalyticsEventType.MetricCalculated, {
        runId: context.runId,
        metricId,
        value,
      });
      published += 1;
    }

    for (const report of context.reports) {
      context.eventPublisher.publish(KnowledgeAnalyticsEventType.ReportGenerated, {
        runId: context.runId,
        reportId: report.id,
        reportType: report.type,
      });
      published += 1;
    }

    context.eventPublisher.publish(KnowledgeAnalyticsEventType.DashboardUpdated, {
      runId: context.runId,
      dashboardId: context.dashboardSnapshot.id,
      metricCount: Object.keys(context.dashboardSnapshot.metrics).length,
    });
    published += 1;

    context.statistics.recordEventPublished(published);

    return context;
  }
}
