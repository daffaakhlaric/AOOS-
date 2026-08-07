import { KnowledgeVersionConfiguration } from "../configuration/knowledge-version-configuration.js";
import type {
  IKnowledgeVersionValidator,
  KnowledgeVersionValidationInput,
  KnowledgeVersionValidationResult,
} from "../contracts/i-knowledge-version-validator.js";

const configuration = new KnowledgeVersionConfiguration();

/** Stage 8 — Configuration: the record must pass `KnowledgeVersionConfiguration#assertValid()` (autoSnapshot budget rule + the secret-key guard on `settings`). */
export class ConfigurationValidator implements IKnowledgeVersionValidator {
  readonly name = "configuration";

  validate(input: KnowledgeVersionValidationInput): KnowledgeVersionValidationResult {
    if (!configuration.validate(input.configuration)) {
      return {
        valid: false,
        issues: [
          {
            path: "configuration",
            message: "Version configuration failed KnowledgeVersionConfiguration validation",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
