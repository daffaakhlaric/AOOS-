import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 9 — Dependency: no self-reference in known policy IDs. */
export class DependencyValidator implements IKnowledgePolicyValidator {
  readonly name = "dependency";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.knownPolicyIds !== undefined) {
      const duplicates = input.knownPolicyIds.filter((id) => id === input.metadata.policyId);
      if (duplicates.length > 1) {
        issues.push({
          path: "knownPolicyIds",
          message: `Policy "${input.metadata.policyId}" appears multiple times in known policies`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
