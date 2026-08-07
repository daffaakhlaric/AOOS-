import type {
  QualityValidationIssue,
  QualityValidationResult,
  IKnowledgeQualityValidator,
  KnowledgeQualityValidationInput,
} from "../contracts/i-knowledge-quality-validator.js";

/** Stage 7 — Configuration: when a `KnowledgeQualityConfiguration` is present, its tuning fields must be within valid ranges. */
export class ConfigurationValidator implements IKnowledgeQualityValidator {
  readonly name = "configuration";

  validate(input: KnowledgeQualityValidationInput): QualityValidationResult {
    const issues: QualityValidationIssue[] = [];
    const configuration = input.configuration;
    if (configuration) {
      if (configuration.timeoutMs !== undefined && configuration.timeoutMs <= 0) {
        issues.push({ path: "configuration.timeoutMs", message: "timeoutMs must be positive" });
      }
      if (
        configuration.retries !== undefined &&
        (configuration.retries < 0 || configuration.retries > 10)
      ) {
        issues.push({
          path: "configuration.retries",
          message: "retries must be between 0 and 10",
        });
      }
      if (configuration.maxFindings !== undefined && configuration.maxFindings <= 0) {
        issues.push({
          path: "configuration.maxFindings",
          message: "maxFindings must be positive",
        });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
