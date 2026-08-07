import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 4 — Publisher: the resolved Publisher must exist and match the declared publisherId. */
export class PublisherValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "publisher";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (!input.publisher) {
      issues.push({
        path: "publisher",
        message: `No Publisher is registered for Publisher Id "${input.metadata.publisherId}"`,
      });
    } else if (input.publisher.publisherId !== input.metadata.publisherId) {
      issues.push({
        path: "metadata.publisherId",
        message: "Resolved Publisher publisherId must match Listing metadata publisherId",
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
