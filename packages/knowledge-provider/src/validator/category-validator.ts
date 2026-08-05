import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a mismatch between `metadata.providerCategory` and `context.providerType`. */
export class CategoryValidator implements IKnowledgeProviderValidator {
  readonly name = "category";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (input.metadata.providerCategory !== input.context.providerType) {
      return {
        valid: false,
        issues: [
          {
            path: "context.providerType",
            message: "Context providerType must match Provider providerCategory",
          },
        ],
      };
    }
    return { valid: true, issues: [] };
  }
}
