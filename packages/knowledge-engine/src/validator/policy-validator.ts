import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Policy" — a `KnowledgePolicy` must declare a non-empty `rule` bag when `enabled`. */
export class PolicyValidator implements IKnowledgeValidatorStage {
  readonly name = "policy";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const policy = input.policy;
    if (policy && policy.enabled && Object.keys(policy.rule).length === 0) {
      issues.push({
        path: "policy.rule",
        message: `Enabled Policy "${policy.id}" declares an empty rule`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
