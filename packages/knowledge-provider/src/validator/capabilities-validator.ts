import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a Provider that declares no Capabilities at all. */
export class CapabilitiesValidator implements IKnowledgeProviderValidator {
  readonly name = "capabilities";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (input.metadata.providerCapabilities.length === 0) {
      return {
        valid: false,
        issues: [
          {
            path: "metadata.providerCapabilities",
            message: "Provider must declare at least one Capability",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
