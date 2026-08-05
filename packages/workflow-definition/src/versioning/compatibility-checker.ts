import semver from "semver";

import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly breakingChanges: readonly string[];
}

/**
 * Compatibility Checker (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md —
 * "VERSIONING"): a real, structural diff between two versions of the same Workflow —
 * same `id`, a strictly greater `version`, no removed `input` field, no removed Node id.
 * This is definition-level compatibility (would a consumer of V(n) still work against
 * V(n+1)) — it does not run or simulate the Workflow.
 */
export class CompatibilityChecker {
  check(previous: WorkflowDefinition, next: WorkflowDefinition): CompatibilityResult {
    const breakingChanges: string[] = [];

    if (previous.id !== next.id) {
      breakingChanges.push(`id changed from "${previous.id}" to "${next.id}"`);
    }

    if (!semver.valid(next.version) || !semver.valid(previous.version)) {
      breakingChanges.push(
        `"${previous.version}" or "${next.version}" is not a valid SemVer string`,
      );
    } else if (!semver.gt(next.version, previous.version)) {
      breakingChanges.push(`version "${next.version}" is not greater than "${previous.version}"`);
    }

    const previousInputKeys = Object.keys(previous.input ?? {});
    const nextInputKeys = new Set(Object.keys(next.input ?? {}));
    for (const key of previousInputKeys) {
      if (!nextInputKeys.has(key)) {
        breakingChanges.push(`input field "${key}" was removed`);
      }
    }

    const nextNodeIds = new Set(next.nodes.map((node) => node.id));
    for (const node of previous.nodes) {
      if (!nextNodeIds.has(node.id)) {
        breakingChanges.push(`node "${node.id}" was removed`);
      }
    }

    return { compatible: breakingChanges.length === 0, breakingChanges };
  }
}
