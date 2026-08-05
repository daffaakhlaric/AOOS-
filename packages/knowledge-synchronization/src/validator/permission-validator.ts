import type {
  IKnowledgeSynchronizationValidatorStage,
  KnowledgeSynchronizationValidationInput,
  KnowledgeSynchronizationValidationResult,
} from "./i-knowledge-synchronization-validator.js";

/** Flags a blank `context.permission` string when the key is present. */
export class PermissionValidator implements IKnowledgeSynchronizationValidatorStage {
  readonly name = "permission";

  validate(
    input: KnowledgeSynchronizationValidationInput,
  ): KnowledgeSynchronizationValidationResult {
    const { permission } = input.context;
    if (permission !== undefined && permission.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "context.permission", message: "Context permission must not be blank" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
