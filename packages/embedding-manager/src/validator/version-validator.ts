import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/** Stage 7 — Version: when a Version is resolved, its versionLabel must be well-formed and its modelId must match the resolved Model. */
export class VersionValidator implements IEmbeddingValidatorStage {
  readonly name = "version";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    const version = input.resolvedVersion;
    if (version) {
      if (version.versionLabel.trim().length === 0) {
        issues.push({
          path: "resolvedVersion.versionLabel",
          message: "Version versionLabel must not be empty",
        });
      }
      if (input.resolvedModel && version.modelId !== input.resolvedModel.modelId) {
        issues.push({
          path: "resolvedVersion.modelId",
          message: "Version modelId must match the resolved Model's modelId",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
