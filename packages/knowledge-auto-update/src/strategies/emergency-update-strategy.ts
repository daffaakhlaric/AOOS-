import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/**
 * Emergency update: full replace with the caller-supplied payload, tagged `emergency: true`.
 * Policy checks such as the update window / rate limit are bypassed for emergency jobs — that
 * bypass decision is made by `KnowledgeUpdateCoordinator`, not here (this strategy only shapes
 * the applied payload).
 */
export class EmergencyUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Emergency;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...task.payload, emergency: true };
  }
}
