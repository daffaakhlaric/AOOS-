import type {
  IKnowledgeIndexValidatorStage,
  KnowledgeIndexValidationInput,
  KnowledgeIndexValidationResult,
} from "./i-knowledge-index-validator.js";

/** Flags duplicate entries in `asset.tags`/`asset.labels` — indexing a duplicated Tag/Label would silently double-count the Tag/Category Index. */
export class MetadataValidator implements IKnowledgeIndexValidatorStage {
  readonly name = "metadata";

  validate(input: KnowledgeIndexValidationInput): KnowledgeIndexValidationResult {
    const issues = [];
    if (new Set(input.asset.tags).size !== input.asset.tags.length) {
      issues.push({ path: "asset.tags", message: "Asset tags must not contain duplicates" });
    }
    if (new Set(input.asset.labels).size !== input.asset.labels.length) {
      issues.push({ path: "asset.labels", message: "Asset labels must not contain duplicates" });
    }
    return { valid: issues.length === 0, issues };
  }
}
