import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class PipelineStageFailureException extends KnowledgeIntelligenceException {
  constructor(stageName: string, cause: unknown) {
    super(`Knowledge intelligence pipeline stage failed: ${stageName}`, {
      code: "PIPELINE_STAGE_FAILURE",
      cause,
      context: { stageName },
    });
  }
}
