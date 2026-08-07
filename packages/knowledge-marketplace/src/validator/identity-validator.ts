import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";
import { isKnowledgeMarketplaceToken } from "../token/knowledge-marketplace-token.js";

/** Stage 1 — Identity: blank/mismatched listingId between metadata and context, and a malformed token. */
export class IdentityValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "identity";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.metadata.listingId.trim().length === 0) {
      issues.push({ path: "metadata.listingId", message: "Listing listingId must not be empty" });
    }
    if (input.metadata.listingId !== input.context.listingId) {
      issues.push({
        path: "metadata.listingId",
        message: "Listing metadata listingId must match Context listingId",
      });
    }
    if (!isKnowledgeMarketplaceToken(input.context.token)) {
      issues.push({
        path: "context.token",
        message: "Context token must be a well-formed KnowledgeMarketplaceToken",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
