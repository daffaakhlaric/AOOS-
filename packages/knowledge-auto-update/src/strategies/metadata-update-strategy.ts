import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Metadata update: merges `payload` on top of `previousPayload` (metadata-only fields). */
export class MetadataUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Metadata;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...(task.previousPayload ?? {}), ...task.payload };
  }
}
