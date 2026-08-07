import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";
import { evaluateKnowledgeValidationPolicy } from "../domain/knowledge-validation-policy.js";

/** Stage 5 — Policy: a resolved Policy must be active and must allow this Request's Validation Category / declared Rule Categories (derived from the resolved Rules). */
export class PolicyValidator implements IKnowledgeValidatorStage {
  readonly name = "policy";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (input.request.policyId && !input.policy) {
      issues.push({
        path: "request.policyId",
        message: `Policy "${input.request.policyId}" does not resolve`,
      });
    }
    if (input.policy) {
      const categories = (input.resolvedRules ?? []).map((rule) => rule.category);
      const result = evaluateKnowledgeValidationPolicy(input.policy, {
        categories,
        category: input.request.category,
      });
      for (const reason of result.reasons) {
        issues.push({ path: "policy", message: reason });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
