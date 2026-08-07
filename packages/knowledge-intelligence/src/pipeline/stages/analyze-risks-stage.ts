import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 8: per-item risk assessment + per-item priority scoring. */
export class AnalyzeRisksStage implements PipelineStage {
  readonly name = "analyze-risks";

  execute(context: PipelineContext): PipelineContext {
    context.riskAssessments = new Map(
      context.items.map((item) => [item.id, context.riskAnalyzer.assess(item)] as const),
    );
    context.priorityScores = new Map(
      context.items.map((item) => [item.id, context.priorityEngine.score(item)] as const),
    );
    return context;
  }
}
