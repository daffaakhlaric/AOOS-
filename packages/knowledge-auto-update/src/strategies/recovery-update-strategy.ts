import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Recovery: merges `payload` over `previousPayload`, stamping `recoveredAt`. */
export class RecoveryUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Recovery;

  protected computeAppliedPayload(task: KnowledgeUpdateTask, now: number): Metadata {
    return { ...(task.previousPayload ?? {}), ...task.payload, recoveredAt: now };
  }
}
