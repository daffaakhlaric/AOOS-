import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";
import { evaluateKnowledgeQualityPolicy } from "../domain/knowledge-quality-policy.js";

/** Stage 6 — Policy: a resolved Policy must be active and must allow this Request's Assessment Mode / declared Dimensions (derived from the resolved Rules). */
export class PolicyValidator implements IKnowledgeQualityValidator {
  readonly name = "policy";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    if (input.request.policyId && !input.policy) {
      issues.push({
        path: "request.policyId",
        message: `Policy "${input.request.policyId}" does not resolve`,
      });
    }
    if (input.policy) {
      const dimensions = (input.resolvedRules ?? []).map((rule) => rule.dimension);
      const result = evaluateKnowledgeQualityPolicy(input.policy, {
        dimensions,
        mode: input.request.mode,
      });
      for (const reason of result.reasons) {
        issues.push({ path: "policy", message: reason });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
