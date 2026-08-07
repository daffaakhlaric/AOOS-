import { ReportType } from "../../types/report-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 10: assembles the top-level `KnowledgeIntelligenceReport` and run statistics. */
export class GenerateIntelligenceReportStage implements PipelineStage {
  readonly name = "generate-intelligence-report";

  execute(context: PipelineContext): PipelineContext {
    const report = context.reportBuilder.build({
      type: ReportType.KnowledgeIntelligence,
      title: "Knowledge Intelligence Report",
      sections: {
        itemCount: context.items.length,
        findings: context.findings ?? [],
        relationships: context.relationships ?? [],
        similarityMatrix: context.similarityMatrix,
        duplicates: context.duplicates ?? [],
        nearDuplicates: context.nearDuplicates ?? [],
        coverageScore: context.coverageScore,
        gapReport: context.gapReport,
        healthReport: context.healthReport,
        recommendations: context.recommendations ?? [],
        insights: context.insights ?? [],
      },
    });

    context.report = report;
    context.registry.putReport(report);
    for (const recommendation of context.recommendations ?? []) {
      context.registry.putRecommendation(recommendation);
    }
    for (const insight of context.insights ?? []) {
      context.registry.putInsight(insight);
    }

    const qualityValues = [...(context.qualityScores?.values() ?? [])].map((s) => s.value);
    const freshnessValues = [...(context.freshnessScores?.values() ?? [])].map((s) => s.value);
    const riskValues = [...(context.riskAssessments?.values() ?? [])].map((r) => r.value);

    context.statistics = context.statisticsFactory.create({
      itemsAnalyzed: context.items.length,
      findingsCount: context.findings?.length ?? 0,
      insightsCount: context.insights?.length ?? 0,
      recommendationsCount: context.recommendations?.length ?? 0,
      duplicatesCount: context.duplicates?.length ?? 0,
      nearDuplicatesCount: context.nearDuplicates?.length ?? 0,
      relationshipsCount: context.relationships?.length ?? 0,
      gapsCount: context.gapReport?.gaps.length ?? 0,
      orphansCount: context.gapReport?.orphans.length ?? 0,
      averageHealthScore: context.healthReport?.overallScore.overall ?? 0,
      averageQualityScore: this.average(qualityValues),
      averageFreshnessScore: this.average(freshnessValues),
      averageRiskScore: this.average(riskValues),
    });

    return context;
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
  }
}
