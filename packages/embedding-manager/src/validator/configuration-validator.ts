import type {
  EmbeddingValidatorStageIssue,
  EmbeddingValidatorStageResult,
  IEmbeddingValidatorStage,
  EmbeddingValidatorValidationInput,
} from "../contracts/i-embedding-validator.js";

/**
 * Stage 6 — Configuration: when a Configuration is resolved, its numeric knobs must be
 * well-formed. NOTE: `EmbeddingConfiguration.embeddingId` is NOT cross-checked against
 * the current Embedding here — a Configuration is commonly registered as a reusable
 * settings template (timeout/retries/batchSize) BEFORE the Embedding it will end up
 * attached to even exists, so enforcing an exact match would create an unresolvable
 * chicken-and-egg ordering requirement. A documented judgment call, see
 * docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Technical Debt".
 */
export class ConfigurationValidator implements IEmbeddingValidatorStage {
  readonly name = "configuration";

  validate(input: EmbeddingValidatorValidationInput): EmbeddingValidatorStageResult {
    const issues: EmbeddingValidatorStageIssue[] = [];
    const configuration = input.configuration;
    if (configuration) {
      if (configuration.timeoutMs !== undefined && configuration.timeoutMs <= 0) {
        issues.push({
          path: "configuration.timeoutMs",
          message: "Configuration timeoutMs must be positive",
        });
      }
      if (configuration.retries !== undefined && configuration.retries < 0) {
        issues.push({
          path: "configuration.retries",
          message: "Configuration retries must not be negative",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
