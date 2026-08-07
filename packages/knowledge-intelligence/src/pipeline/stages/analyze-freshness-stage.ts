import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 7: per-item freshness scoring, driven by the injected `IClock`. */
export class AnalyzeFreshnessStage implements PipelineStage {
  readonly name = "analyze-freshness";

  execute(context: PipelineContext): PipelineContext {
    const scores = new Map(
      context.items.map((item) => [item.id, context.freshnessEngine.score(item)] as const),
    );
    context.freshnessScores = scores;
    return context;
  }
}
