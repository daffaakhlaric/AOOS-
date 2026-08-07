import type {
  IKnowledgePolicyValidator,
  KnowledgePolicyValidationInput,
  KnowledgePolicyValidationIssue,
  KnowledgePolicyValidationResult,
} from "../contracts/i-knowledge-policy-validator.js";

/** Stage 4 — Rules: rule count within limits. */
export class RulesValidator implements IKnowledgePolicyValidator {
  readonly name = "rules";

  validate(input: KnowledgePolicyValidationInput): KnowledgePolicyValidationResult {
    const issues: KnowledgePolicyValidationIssue[] = [];
    if (input.ruleCount !== undefined && input.configuration.maxRules !== undefined) {
      if (input.ruleCount > input.configuration.maxRules) {
        issues.push({
          path: "rules",
          message: `Rule count ${String(input.ruleCount)} exceeds maxRules ${String(input.configuration.maxRules)}`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
