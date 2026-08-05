import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Permission" — a `KnowledgePermission`'s `scope` must set at least `tenantId` (already zod-required), and `action` must be non-blank. */
export class PermissionValidator implements IKnowledgeValidatorStage {
  readonly name = "permission";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const permission = input.permission;
    if (permission && permission.action.trim().length === 0) {
      issues.push({
        path: "permission.action",
        message: `Permission "${permission.id}" declares a blank action`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
