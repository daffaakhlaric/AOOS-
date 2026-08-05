import type {
  IKnowledgeProviderValidator,
  KnowledgeProviderValidationInput,
  KnowledgeProviderValidationResult,
} from "../contracts/i-knowledge-provider-validator.js";

/** Flags a blank `context.tenantId`. */
export class TenantValidator implements IKnowledgeProviderValidator {
  readonly name = "tenant";

  validate(input: KnowledgeProviderValidationInput): KnowledgeProviderValidationResult {
    if (input.context.tenantId.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "context.tenantId", message: "Context tenantId must not be empty" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
