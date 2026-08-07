import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

/** Stage 4 — Rule: every declared `ruleId` must resolve against the Rule Registry bucket. */
export class RuleValidator implements IKnowledgeQualityValidator {
  readonly name = "rule";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (input.request.ruleIds.length > 0 && input.rulesResolvable === false) {
      const resolvedIds = new Set((input.resolvedRules ?? []).map((rule) => rule.ruleId));
      const missing = input.request.ruleIds.filter((ruleId) => !resolvedIds.has(ruleId));
      for (const ruleId of missing) {
        issues.push({
          path: "request.ruleIds",
          message: `Rule "${ruleId}" does not resolve`,
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
