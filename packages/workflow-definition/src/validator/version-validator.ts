import semver from "semver";

import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

/** Version Validation (docs/PROMPT-005.6A-WORKFLOW-DEFINITION-LANGUAGE.md — "VERSIONING"): `version` must be a valid, non-zero SemVer string. */
export class VersionValidator implements IWorkflowValidator {
  readonly name = "version";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!semver.valid(workflow.version)) {
      issues.push({
        path: "version",
        message: `"${workflow.version}" is not a valid SemVer string`,
      });
    } else if (semver.eq(workflow.version, "0.0.0")) {
      issues.push({ path: "version", message: '"0.0.0" is not a publishable Workflow version' });
    }

    return { valid: issues.length === 0, issues };
  }
}
