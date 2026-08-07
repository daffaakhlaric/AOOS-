import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 5: coverage score + gap/orphan detection from caller-supplied taxonomy/adjacency data. */
export class AnalyzeCoverageStage implements PipelineStage {
  readonly name = "analyze-coverage";

  execute(context: PipelineContext): PipelineContext {
    const taxonomy = context.taxonomy ?? [];
    const adjacency = context.adjacency ?? {};

    context.coverageScore = context.coverageAnalyzer.score(taxonomy);
    const gaps = context.gapAnalyzer.findGaps(taxonomy);
    const orphans = context.gapAnalyzer.findOrphans(
      context.items.map((item) => item.id),
      adjacency,
    );

    context.gapReport = context.gapReportFactory.create(
      context.coverageScore.value,
      gaps.map((entry) => ({ topic: entry.topic, itemCount: entry.itemCount })),
      orphans,
    );

    return context;
  }
}
