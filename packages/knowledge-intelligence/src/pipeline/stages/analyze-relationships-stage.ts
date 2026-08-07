import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 3: relationship discovery over the collected corpus. */
export class AnalyzeRelationshipsStage implements PipelineStage {
  readonly name = "analyze-relationships";

  execute(context: PipelineContext): PipelineContext {
    context.relationships = context.relationshipAnalyzer.discover(context.items);
    return context;
  }
}
