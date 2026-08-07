import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/** Dependency update: full replace, tagged `dependencyUpdated: true`. */
export class DependencyUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Dependency;

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    return { ...task.payload, dependencyUpdated: true };
  }
}
