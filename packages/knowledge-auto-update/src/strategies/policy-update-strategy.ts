import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Policy update: full replace, tagged `policyUpdated: true`. */
export class PolicyUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Policy;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...task.payload, policyUpdated: true };
  }
}
