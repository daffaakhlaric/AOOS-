import type { KnowledgeGenerationJob } from "../domain/knowledge-generation-job.js";

/**
 * "IKnowledgeGenerationScheduler" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md —
 * "Extension Points") — interface ONLY. A future seam for a caller-supplied external
 * scheduler that owns real queueing/execution timing for a `KnowledgeGenerationJob`.
 */
export interface IKnowledgeGenerationScheduler {
  schedule(job: KnowledgeGenerationJob): Promise<void>;
}
