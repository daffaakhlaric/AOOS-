import { KnowledgeProviderConfiguration } from "../configuration/knowledge-provider-configuration.js";
import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

const configuration = new KnowledgeProviderConfiguration();

/** Flags a `metadata.providerConfiguration` containing secret-looking keys — "NO OAuth. NO Secrets. Only metadata." */
export class ConfigurationValidator implements IKnowledgeProviderValidator {
  readonly name = "configuration";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (!configuration.validate(input.metadata.providerConfiguration)) {
      return {
        valid: false,
        issues: [
          {
            path: "metadata.providerConfiguration",
            message: "Provider configuration must not contain secret-looking keys",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
