import type {
  ValidatorStageIssue,
  ValidatorStageResult,
  IKnowledgeValidatorStage,
  KnowledgeValidatorValidationInput,
} from "../contracts/i-knowledge-validator-validator.js";

/** Stage 7 — Configuration: when a `KnowledgeValidationConfiguration` is present, its tuning fields must be within valid ranges. */
export class ConfigurationValidator implements IKnowledgeValidatorStage {
  readonly name = "configuration";

  validate(input: KnowledgeValidatorValidationInput): ValidatorStageResult {
    const issues: ValidatorStageIssue[] = [];
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
