import { KnowledgeSourceConfiguration } from "../configuration/knowledge-source-configuration.js";
import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

const configuration = new KnowledgeSourceConfiguration();

/** Flags a `configuration` that fails `KnowledgeSourceConfiguration#assertValid()` (Auto Sync without Enabled, Sync Mode/Schedule mismatch, incomplete Schedule descriptor). */
export class ConfigurationValidator implements IKnowledgeSourceValidator {
  readonly name = "configuration";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    if (!configuration.validate(input.configuration)) {
      return {
        valid: false,
        issues: [
          {
            path: "configuration",
            message: "Source configuration failed KnowledgeSourceConfiguration validation",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
