import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Scheduled update: full replace with the caller-supplied payload. */
export class ScheduledUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Scheduled;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return task.payload;
  }
}
