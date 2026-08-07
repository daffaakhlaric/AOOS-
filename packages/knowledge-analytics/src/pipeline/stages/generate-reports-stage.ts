import { InvalidSampleException } from "../../errors/invalid-sample-exception.js";
import { KnowledgeReportType } from "../../types/report-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

const DOMAIN_REPORT_TYPES: readonly KnowledgeReportType[] = [
  KnowledgeReportType.Usage,
  KnowledgeReportType.Performance,
  KnowledgeReportType.Graph,
  KnowledgeReportType.Quality,
  KnowledgeReportType.Embedding,
  KnowledgeReportType.Trend,
  KnowledgeReportType.Cost,
  KnowledgeReportType.Recommendation,
];

/**
 * Stage 4 — Generate Reports: assembles a `Summary` report (every section) plus one report per
 * single-domain report type, via `KnowledgeAnalyticsReportBuilder`, and stores each in the
 * `KnowledgeReportRegistry`. `DashboardSnapshot` is intentionally not produced here — it is its
 * own pipeline stage (5) with its own entity shape.
 */
export class GenerateReportsStage implements PipelineStage {
  readonly name = "GenerateReports";

  execute(context: PipelineContext): PipelineContext {
    const collected = context.collected as Record<string, unknown> | undefined;
    if (!collected) {
      throw new InvalidSampleException(
        "GenerateReports ran before CollectMetrics populated `collected`",
      );
    }

    const { reportBuilder } = context;
    reportBuilder.reset();
    reportBuilder
      .withUsage(collected.usage)
      .withSearch(collected.search)
      .withRetrieval(collected.retrieval)
      .withQuery(collected.query)
      .withEmbedding(collected.embedding)
      .withGraph(collected.graph)
      .withQuality(collected.quality)
      .withPerformance(collected.performance)
      .withTrend(collected.trend)
      .withCost(collected.cost)
      .withRecommendation(collected.recommendation);

    const generatedAt = context.clock();
    const reports = [
      reportBuilder.build(KnowledgeReportType.Summary, { generatedAt }),
      ...DOMAIN_REPORT_TYPES.map((type) => reportBuilder.build(type, { generatedAt })),
    ];

    for (const report of reports) {
      context.reportRegistry.add(report);
    }
    context.statistics.recordReportGenerated(reports.length);

    return { ...context, reports };
  }
}
