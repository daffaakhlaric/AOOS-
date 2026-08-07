import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 2 — Metadata: required metadata fields. */
export class MetadataValidator implements IKnowledgePolicyValidator {
  readonly name = "metadata";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.metadata.policyName.trim().length === 0) {
      issues.push({ path: "metadata.policyName", message: "Policy policyName must not be empty" });
    }
    if (input.metadata.tenantId.trim().length === 0) {
      issues.push({ path: "metadata.tenantId", message: "Policy tenantId must not be empty" });
    }
    if (input.metadata.priority < 0) {
      issues.push({ path: "metadata.priority", message: "Policy priority must be non-negative" });
    }
    return { valid: issues.length === 0, issues };
  }
}
