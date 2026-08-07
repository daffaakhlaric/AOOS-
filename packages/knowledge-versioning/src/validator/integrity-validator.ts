import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationIssue,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";

/**
 * Stage 10 — Integrity: structural completeness of the record pair — coherent
 * timestamps (`createdAt` ≤ `updatedAt`), no blank labels/tags, and the configuration
 * must belong to the same version as the metadata.
 */
export class IntegrityValidator implements IKnowledgeVersionValidator {
  readonly name = "integrity";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    const issues: KnowledgeVersionValidationIssue[] = [];
    const createdAt = Date.parse(input.metadata.createdAt);
    const updatedAt = Date.parse(input.metadata.updatedAt);
    if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) {
      issues.push({
        path: "metadata.createdAt",
        message: "Version createdAt/updatedAt must be valid timestamps",
      });
    } else if (createdAt > updatedAt) {
      issues.push({
        path: "metadata.updatedAt",
        message: "Version updatedAt must not precede createdAt",
      });
    }
    if (input.metadata.labels.some((label) => label.trim().length === 0)) {
      issues.push({ path: "metadata.labels", message: "Version labels must not be blank" });
    }
    if (input.metadata.tags.some((tag) => tag.trim().length === 0)) {
      issues.push({ path: "metadata.tags", message: "Version tags must not be blank" });
    }
    if (input.configuration.versionId !== input.metadata.versionId) {
      issues.push({
        path: "configuration.versionId",
        message: "Configuration versionId must match metadata versionId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
