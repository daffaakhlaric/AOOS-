import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 10 — Integrity: cross-record consistency between the Listing's metadata and its underlying Package. */
export class IntegrityValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "integrity";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.metadata.packageId !== input.package.packageId) {
      issues.push({
        path: "metadata.packageId",
        message: "Listing metadata packageId must match the underlying Package's packageId",
      });
    }
    if (input.metadata.marketplaceType !== input.package.marketplaceType) {
      issues.push({
        path: "metadata.marketplaceType",
        message:
          "Listing metadata marketplaceType must match the underlying Package's marketplaceType",
      });
    }
    if (input.metadata.category !== input.package.category) {
      issues.push({
        path: "metadata.category",
        message: "Listing metadata category must match the underlying Package's category",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
