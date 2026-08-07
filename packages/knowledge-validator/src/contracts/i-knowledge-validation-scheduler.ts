import type { KnowledgeValidationJob } from "../domain/knowledge-validation-job.js";

/**
 * "IKnowledgeValidationScheduler" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * scheduler that owns real queueing/execution timing for a `KnowledgeValidationJob`.
 */
export interface IKnowledgeValidationScheduler {
  schedule(job: KnowledgeValidationJob): Promise<void>;
}
