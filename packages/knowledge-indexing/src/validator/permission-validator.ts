import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags a missing `asset.owner.userId` — the Permission Index needs an Owner to key access checks on. */
export class PermissionValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "permission";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    if (!input.asset.owner.userId || input.asset.owner.userId.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "asset.owner.userId", message: "Asset owner userId must not be blank" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
