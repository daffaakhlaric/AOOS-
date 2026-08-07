import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Incremental update: merges `payload` on top of `previousPayload` (partial-diff apply). */
export class IncrementalUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Incremental;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...(task.previousPayload ?? {}), ...task.payload };
  }
}
