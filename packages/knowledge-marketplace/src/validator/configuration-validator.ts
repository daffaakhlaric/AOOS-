import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 9 — Configuration: Context/metadata tenancy configuration must agree. */
export class ConfigurationValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "configuration";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.context.correlationId.trim().length === 0) {
      issues.push({
        path: "context.correlationId",
        message: "Context correlationId must not be empty",
      });
    }
    if (input.metadata.tenantId !== input.context.tenantId) {
      issues.push({
        path: "metadata.tenantId",
        message: "Listing metadata tenantId must match Context tenantId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
