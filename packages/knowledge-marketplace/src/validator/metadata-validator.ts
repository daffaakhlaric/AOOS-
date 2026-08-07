import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 2 — Metadata: required metadata fields. */
export class MetadataValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "metadata";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.metadata.title.trim().length === 0) {
      issues.push({ path: "metadata.title", message: "Listing title must not be empty" });
    }
    if (input.metadata.tenantId.trim().length === 0) {
      issues.push({ path: "metadata.tenantId", message: "Listing tenantId must not be empty" });
    }
    if (input.metadata.packageId.trim().length === 0) {
      issues.push({ path: "metadata.packageId", message: "Listing packageId must not be empty" });
    }
    return { valid: issues.length === 0, issues };
  }
}
