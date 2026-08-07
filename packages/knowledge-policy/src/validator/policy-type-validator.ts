import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";
import { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";

/** Stage 7 — Policy Type: valid policy type enum. */
export class PolicyTypeValidator implements IKnowledgePolicyValidator {
  readonly name = "policyType";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    const validTypes = Object.values(KnowledgePolicyType) as string[];
    if (!validTypes.includes(input.metadata.policyType)) {
      issues.push({
        path: "metadata.policyType",
        message: `Policy type "${input.metadata.policyType}" is not a valid KnowledgePolicyType`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
