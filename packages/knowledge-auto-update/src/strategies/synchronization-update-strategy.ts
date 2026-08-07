import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Synchronization: re-applies the current payload, stamping `synchronizedAt`. */
export class SynchronizationUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Synchronization;

  protected computeAppliedPayload(task: KnowledgeUpdateTask, now: number): Metadata {
    return { ...task.payload, synchronizedAt: now };
  }
}
