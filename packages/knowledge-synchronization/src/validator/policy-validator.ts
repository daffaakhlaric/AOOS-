import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `context.policy` string when the key is present. */
export class PolicyValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "policy";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const { policy } = input.context;
    if (policy !== undefined && policy.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "context.policy", message: "Context policy must not be blank" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
