import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";
import { EmbeddingModelName } from "../domain/embedding-model-name.js";
import { EmbeddingProviderType } from "../domain/embedding-provider-type.js";

/**
 * Stage 9 — Dependency: cross-field structural dependency checks, e.g. `Custom
 * Provider` requires `modelName === custom` — a real dependency rule between two
 * fields of the same Request, distinct from Stage 3/4's simple well-formedness checks.
 */
export class DependencyValidator implements IEmbeddingValidatorStage {
  readonly name = "dependency";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (
      input.request.providerType === EmbeddingProviderType.CUSTOM_PROVIDER &&
      input.request.modelName !== EmbeddingModelName.CUSTOM
    ) {
      issues.push({
        path: "request.modelName",
        message: 'Provider "custom_provider" requires modelName "custom"',
      });
    }
    if (input.request.textReference.trim().length === 0) {
      issues.push({
        path: "request.textReference",
        message: "Request textReference must not be empty",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
