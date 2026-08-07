import { KnowledgeAutoUpdateEventType } from "../../events/knowledge-auto-update-event-type.js";
import type { PipelineContext, PipelineStage } from "../pipeline-stage.js";

/** Stage 3: validates the job's structural well-formedness before doing any further work. */
export class ValidateUpdateStage implements PipelineStage {
  readonly name = "validate-update";

  execute(context: PipelineContext): PipelineContext {
    context.validator.validateJobOrThrow(context.job);
    context.statistics.recordValidation(0);
    context.eventPublisher.publish(KnowledgeAutoUpdateEventType.UpdateValidated, {
      jobId: context.job.id,
      runId: context.runId,
    });
    return context;
  }
}
