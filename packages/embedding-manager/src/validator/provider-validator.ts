import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/**
 * Stage 3 — Provider: pre-flight well-formedness of the Request's declared
 * `providerType`, and (when already resolved) that the resolved `EmbeddingProvider` is
 * active. Distinct from the Pipeline's own Provider Resolution stage (Pipeline stage 2),
 * which performs the actual Registry lookup — this stage only checks the field/reference
 * shape BEFORE resolution is attempted.
 */
export class ProviderValidator implements IEmbeddingValidatorStage {
  readonly name = "provider";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    if (!input.request.providerType) {
      issues.push({
        path: "request.providerType",
        message: "Request providerType must be declared",
      });
    }
    if (input.resolvedProvider && !input.resolvedProvider.active) {
      issues.push({
        path: "resolvedProvider.active",
        message: `Provider "${input.resolvedProvider.providerId}" is not active`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
