import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

/** Flags a blank `metadata.providerId`, and a mismatch between `metadata.providerId` and `context.providerId`. */
export class ProviderReferenceValidator implements IKnowledgeSourceValidator {
  readonly name = "providerReference";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    const issues = [];
    if (input.metadata.providerId.trim().length === 0) {
      issues.push({ path: "metadata.providerId", message: "Source providerId must not be empty" });
    }
    if (input.metadata.providerId !== input.context.providerId) {
      issues.push({
        path: "metadata.providerId",
        message: "Source metadata providerId must match Context providerId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
