import { KnowledgeUpdateResult } from "../entities/knowledge-update-result.js";
import type { Metadata } from "../types/common.js";
import { generateId } from "../utils/id-generator.js";

/** Real Factory-pattern class building `KnowledgeUpdateResult` instances. */
export class KnowledgeUpdateResultFactory {
  createSuccess(
    taskId: string,
    jobId: string,
    appliedPayload: Metadata,
    durationMs: number,
    now: number,
  ): KnowledgeUpdateResult {
    return new KnowledgeUpdateResult({
      id: generateId("result"),
      taskId,
      jobId,
      success: true,
      appliedPayload,
      errorMessage: undefined,
      durationMs,
      completedAt: now,
    });
  }

  createFailure(
    taskId: string,
    jobId: string,
    errorMessage: string,
    durationMs: number,
    now: number,
  ): KnowledgeUpdateResult {
    return new KnowledgeUpdateResult({
      id: generateId("result"),
      taskId,
      jobId,
      success: false,
      appliedPayload: undefined,
      errorMessage,
      durationMs,
      completedAt: now,
    });
  }
}
