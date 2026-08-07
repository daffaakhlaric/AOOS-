import { KnowledgeAnalyticsException } from "./knowledge-analytics-exception.js";

/** Thrown when a `KnowledgeAnalyticsPipeline` stage throws while executing. */
export class PipelineStageFailureException extends KnowledgeAnalyticsException {
  constructor(stageName: string, cause: unknown) {
    super(`Knowledge analytics pipeline stage "${stageName}" failed: ${String(cause)}`, {
      code: "PIPELINE_STAGE_FAILURE",
      cause,
      context: { stageName },
    });
  }
}
