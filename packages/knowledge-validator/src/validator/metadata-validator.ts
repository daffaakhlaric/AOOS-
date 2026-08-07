import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";

/** Stage 2 — Metadata: blank title, blank tenantId, malformed timestamps. */
export class MetadataValidator implements IKnowledgeValidatorStage {
  readonly name = "metadata";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
    if (input.metadata.title.trim().length === 0) {
      issues.push({ path: "metadata.title", message: "Metadata title must not be empty" });
    }
    if (input.metadata.tenantId.trim().length === 0) {
      issues.push({ path: "metadata.tenantId", message: "Metadata tenantId must not be empty" });
    }
    if (Number.isNaN(Date.parse(input.metadata.createdAt))) {
      issues.push({
        path: "metadata.createdAt",
        message: "Metadata createdAt must be a valid ISO timestamp",
      });
    }
    if (Number.isNaN(Date.parse(input.metadata.updatedAt))) {
      issues.push({
        path: "metadata.updatedAt",
        message: "Metadata updatedAt must be a valid ISO timestamp",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
