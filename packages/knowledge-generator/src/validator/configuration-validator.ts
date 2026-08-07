import type {
  GeneratorValidationIssue,
  GeneratorValidationResult,
  IKnowledgeGeneratorValidator,
  KnowledgeGeneratorValidationInput,
} from "../contracts/i-knowledge-generator-validator.js";

/** Stage 8 — Configuration: when a `KnowledgeGenerationConfiguration` is present, its tuning fields must be within valid ranges. */
export class ConfigurationValidator implements IKnowledgeGeneratorValidator {
  readonly name = "configuration";

  validate(input: KnowledgeGeneratorValidationInput): GeneratorValidationResult {
    const issues: GeneratorValidationIssue[] = [];
    const configuration = input.configuration;
    if (configuration) {
      if (configuration.maxTokens !== undefined && configuration.maxTokens <= 0) {
        issues.push({ path: "configuration.maxTokens", message: "maxTokens must be positive" });
      }
      if (
        configuration.temperature !== undefined &&
        (configuration.temperature < 0 || configuration.temperature > 2)
      ) {
        issues.push({
          path: "configuration.temperature",
          message: "temperature must be between 0 and 2",
        });
      }
      if (configuration.timeoutMs !== undefined && configuration.timeoutMs <= 0) {
        issues.push({ path: "configuration.timeoutMs", message: "timeoutMs must be positive" });
      }
    }
    return { valid: issues.length === 0, issues };
  }
}
