import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 6: per-item quality scoring. */
export class AnalyzeQualityStage implements PipelineStage {
  readonly name = "analyze-quality";

  execute(context: PipelineContext): PipelineContext {
    const scores = new Map(
      context.items.map((item) => [item.id, context.qualityEngine.score(item)] as const),
    );
    context.qualityScores = scores;
    return context;
  }
}
