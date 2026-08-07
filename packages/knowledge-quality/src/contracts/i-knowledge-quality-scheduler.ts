import type { KnowledgeQualityAssessmentJob } from "../domain/knowledge-quality-assessment-job.js";

/**
 * "IKnowledgeQualityScheduler" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY. A future seam for a caller-supplied external scheduler
 * that owns real queueing/execution timing for a `KnowledgeQualityJob`.
 */
export interface IKnowledgeQualityScheduler {
  schedule(job: KnowledgeQualityAssessmentJob): Promise<void>;
}
