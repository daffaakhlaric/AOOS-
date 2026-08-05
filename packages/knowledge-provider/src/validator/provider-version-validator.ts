import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a blank `metadata.providerVersion`, and a mismatch with `context.providerVersion` when both are set. */
export class ProviderVersionValidator implements IKnowledgeProviderValidator {
  readonly name = "providerVersion";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    const issues = [];
    if (input.metadata.providerVersion.trim().length === 0) {
      issues.push({
        path: "metadata.providerVersion",
        message: "Provider providerVersion must not be empty",
      });
    }
    const { providerVersion } = input.context;
    if (providerVersion !== undefined && providerVersion !== input.metadata.providerVersion) {
      issues.push({
        path: "context.providerVersion",
        message: "Context providerVersion must match Provider providerVersion when set",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
