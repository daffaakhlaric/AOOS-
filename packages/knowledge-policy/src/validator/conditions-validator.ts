import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 5 — Conditions: correlationId exists. */
export class ConditionsValidator implements IKnowledgePolicyValidator {
  readonly name = "conditions";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.context.correlationId.trim().length === 0) {
      issues.push({
        path: "context.correlationId",
        message: "Context correlationId must not be empty",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
