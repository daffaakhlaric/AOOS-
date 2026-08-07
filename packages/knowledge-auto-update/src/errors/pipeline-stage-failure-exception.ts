import { KnowledgeAutoUpdateException } from "./knowledge-auto-update-exception.js";

export class PipelineStageFailureException extends KnowledgeAutoUpdateException {
  constructor(stageName: string, cause: unknown) {
    super(
      `Knowledge update pipeline stage "${stageName}" failed: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { code: "PIPELINE_STAGE_FAILURE", cause, context: { stageName } },
    );
  }
}
