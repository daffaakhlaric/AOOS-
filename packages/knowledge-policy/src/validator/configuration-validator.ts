import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 8 — Configuration: configuration limits are consistent. */
export class ConfigurationValidator implements IKnowledgePolicyValidator {
  readonly name = "configuration";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.configuration.policyId !== input.metadata.policyId) {
      issues.push({
        path: "configuration.policyId",
        message: "Configuration policyId must match metadata policyId",
      });
    }
    if (input.configuration.maxRules !== undefined && input.configuration.maxRules < 1) {
      issues.push({
        path: "configuration.maxRules",
        message: "Configuration maxRules must be at least 1",
      });
    }
    if (
      input.configuration.maxAssignments !== undefined &&
      input.configuration.maxAssignments < 1
    ) {
      issues.push({
        path: "configuration.maxAssignments",
        message: "Configuration maxAssignments must be at least 1",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
