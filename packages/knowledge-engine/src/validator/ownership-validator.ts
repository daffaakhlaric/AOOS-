import type {
  IKnowledgeValidatorStage,
  KnowledgeValidationInput,
  KnowledgeValidationResult,
} from "./i-knowledge-validator.js";

/** "Ownership" — the Owner's `assignedAt` cannot be in the future. */
export class OwnershipValidator implements IKnowledgeValidatorStage {
  readonly name = "ownership";

  validate(input: KnowledgeValidationInput): KnowledgeValidationResult {
    const issues: KnowledgeValidationResult["issues"][number][] = [];
    const owner = input.asset?.owner;
    if (owner && Date.parse(owner.assignedAt) > Date.now()) {
      issues.push({
        path: "owner.assignedAt",
        message: "Owner assignedAt cannot be in the future",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
