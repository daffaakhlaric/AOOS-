import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Retry: full replace, tagged with the attempt number this retry corresponds to. */
export class RetryUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Retry;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...task.payload, retryAttempt: task.attempt };
  }
}
