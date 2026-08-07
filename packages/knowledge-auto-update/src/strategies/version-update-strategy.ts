import type { KnowledgeUpdateTask } from "../entities/knowledge-update-task.js";
import { KnowledgeVersionComparator } from "../services/knowledge-version-comparator.js";
import type { Metadata } from "../types/common.js";
import { KnowledgeUpdateType } from "../types/update-type.js";

import { BaseKnowledgeUpdateStrategy } from "./base-knowledge-update-strategy.js";

/**
 * Version update: requires `payload.version` to be a valid version string that is newer than
 * `previousPayload.version` (when a previous version is present). Throws (turned into a failure
 * result by the base class) otherwise — this is the one strategy that can genuinely fail on
 * caller-supplied data, not just structurally.
 */
export class VersionUpdateStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Version;
  private readonly comparator: KnowledgeVersionComparator;

  constructor(comparator: KnowledgeVersionComparator = new KnowledgeVersionComparator()) {
    super();
    this.comparator = comparator;
  }

  protected computeAppliedPayload(task: KnowledgeUpdateTask): Metadata {
    const nextVersion = task.payload.version;
    if (typeof nextVersion !== "string" || !this.comparator.isValid(nextVersion)) {
      throw new Error("version update requires a valid payload.version string");
    }
    const previousVersion = task.previousPayload?.version;
    if (
      typeof previousVersion === "string" &&
      !this.comparator.isNewer(nextVersion, previousVersion)
    ) {
      throw new Error(
        `version update requires payload.version (${nextVersion}) to be newer than previous (${previousVersion})`,
      );
    }
    return { ...task.payload, version: nextVersion };
  }
}
