import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Refresh: re-applies the current payload, stamping `refreshedAt`. */
export class RefreshUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Refresh;

  protected computeAppliedPayload(task: KnowledgeUpdateTask, now: number): Metadata {
    return { ...task.payload, refreshedAt: now };
  }
}
