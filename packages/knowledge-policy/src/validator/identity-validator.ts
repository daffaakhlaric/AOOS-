import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";
import { isKnowledgePolicyToken } from "../token/knowledge-policy-token.js";

/** Stage 1 — Identity: blank/mismatched policyId between metadata and context, and a malformed token. */
export class IdentityValidator implements IKnowledgePolicyValidator {
  readonly name = "identity";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.metadata.policyId.trim().length === 0) {
      issues.push({ path: "metadata.policyId", message: "Policy policyId must not be empty" });
    }
    if (input.metadata.policyId !== input.context.policyId) {
      issues.push({
        path: "metadata.policyId",
        message: "Policy metadata policyId must match Context policyId",
      });
    }
    if (!isKnowledgePolicyToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgePolicyToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
