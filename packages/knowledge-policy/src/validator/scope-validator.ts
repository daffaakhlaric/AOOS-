import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 3 — Scope: context tenant is valid. */
export class ScopeValidator implements IKnowledgePolicyValidator {
  readonly name = "scope";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.context.tenantId.trim().length === 0) {
      issues.push({ path: "context.tenantId", message: "Context tenantId must not be empty" });
    }
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "context.tenantId",
        message: "Metadata tenantId must match Context tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
