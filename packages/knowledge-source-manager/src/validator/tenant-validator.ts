import type {
  IKnowledgeSourceValidator,
  KnowledgeSourceValidationInput,
  KnowledgeSourceValidationResult,
} from "../contracts/i-knowledge-source-validator.js";

/** Flags a blank `context.tenantId`. */
export class TenantValidator implements IKnowledgeSourceValidator {
  readonly name = "tenant";

  validate(input: KnowledgeSourceValidationInput): KnowledgeSourceValidationResult {
    if (input.context.tenantId.trim().length === 0) {
      return {
        valid: false,
        issues: [{ path: "context.tenantId", message: "Context tenantId must not be empty" }],
      };
    }
    return { valid: true, issues: [] };
  }
}
