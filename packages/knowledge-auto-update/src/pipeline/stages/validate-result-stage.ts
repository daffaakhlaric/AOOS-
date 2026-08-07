import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 8: validates the completed `KnowledgeUpdateResult`'s own correctness/invariants. */
export class ValidateResultStage implements PipelineStage {
  readonly name = "validate-result";

  execute(context: PipelineContext): PipelineContext {
    if (context.result) {
      context.validator.validateResultOrThrow(context.result);
    }
    return context;
  }
}
