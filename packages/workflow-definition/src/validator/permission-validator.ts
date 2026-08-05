import type { WorkflowDefinition } from "../schemas/workflow-definition.js";

import type {
  IWorkflowValidator,
  ValidationIssue,
  ValidationResult,
} from "./i-workflow-validator.js";

const PERMISSION_PATTERN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/** Structurally checks every `permissions` entry is a `resource.action` string — mirrors `@aos/registry`/`@aos/event-bus`'s Permission Validator. */
export class PermissionValidator implements IWorkflowValidator {
  readonly name = "permission";

  validate(workflow: WorkflowDefinition): ValidationResult {
    const issues: ValidationIssue[] = [];

    for (const permission of workflow.permissions ?? []) {
      if (!PERMISSION_PATTERN.test(permission)) {
        issues.push({
          path: "permissions",
          message: `"${permission}" is not a valid "resource.action" permission string`,
        });
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
