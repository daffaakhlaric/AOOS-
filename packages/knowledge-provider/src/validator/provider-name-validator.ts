import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a blank `metadata.providerName`. */
export class ProviderNameValidator implements IKnowledgeProviderValidator {
  readonly name = "providerName";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (input.metadata.providerName.trim().length === 0) {
      return {
        valid: false,
        issues: [
          { path: "metadata.providerName", message: "Provider providerName must not be empty" },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
