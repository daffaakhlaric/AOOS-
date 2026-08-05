import type {
  IKnowledgeRuntimeValidatorStage,
  KnowledgeRuntimeValidationInput,
  KnowledgeRuntimeValidationResult,
} from "./i-knowledge-runtime-validator.js";

/** Flags a `context.policy` reference that is present but blank — actual policy evaluation is `PolicyMiddleware`'s job via `@aos/knowledge-engine`'s `KnowledgePolicyEngine`, never duplicated here. */
export class RuntimePolicyValidator implements IKnowledgeRuntimeValidatorStage {
  readonly name = "policy";

  validate(input: KnowledgeRuntimeValidationInput): KnowledgeRuntimeValidationResult {
    const { policy } = input.execution.context;
    if (policy !== undefined && policy.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "context.policy", message: "Context policy, if set, must not be blank" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
