import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { KnowledgeValidationCategory } from "../domain/knowledge-validation-category.js";

/**
 * Stage 9 — Dependency: cross-field structural dependency checks, e.g. every
 * non-`Custom Validation` Category requires at least one Rule — a real dependency rule
 * between two fields of the same Request, distinct from Stage 4/5's simple
 * resolvability checks.
 */
export class DependencyValidator implements IKnowledgeValidatorStage {
  readonly name = "dependency";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (
      input.request.category !== KnowledgeValidationCategory.CUSTOM_VALIDATION &&
      input.request.ruleIds.length === 0
    ) {
      issues.push({
        path: "request.ruleIds",
        message: `Validation Category "${input.request.category}" requires at least one Rule`,
      });
    }
    /* A referenced Policy with `requireApproval` and no Configuration is a common
     * misconfiguration in production — flagged only when a Policy was actually
     * resolved (so this stage stays a pure function of its input). */
    if (input.policy?.requireApproval && !input.configuration) {
      issues.push({
        path: "request.configurationId",
        message: `Policy "${input.request.policyId}" requires approval — a Configuration record is required`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
