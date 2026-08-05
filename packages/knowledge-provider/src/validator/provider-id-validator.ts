import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a blank `metadata.providerId`/`context.providerId`, and a mismatch between the two. */
export class ProviderIdValidator implements IKnowledgeProviderValidator {
  readonly name = "providerId";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    const issues = [];
    if (input.metadata.providerId.trim().length === 0) {
      issues.push({
        path: "metadata.providerId",
        message: "Provider providerId must not be empty",
      });
    }
    if (input.context.providerId.trim().length === 0) {
      issues.push({ path: "context.providerId", message: "Context providerId must not be empty" });
    }
    if (input.metadata.providerId !== input.context.providerId) {
      issues.push({
        path: "metadata.providerId",
        message: "Provider providerId must match Context providerId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
