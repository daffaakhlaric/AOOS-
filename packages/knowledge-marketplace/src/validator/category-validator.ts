import type {
  IKnowledgeMarketplaceValidator,
  KnowledgeMarketplaceValidationInput,
  MarketplaceValidationIssue,
  MarketplaceValidationResult,
} from "../contracts/i-knowledge-marketplace-validator.js";

/** Stage 3 — Category: a `Custom` category must resolve to a registered `MarketplaceCategory`. */
export class CategoryValidator implements IKnowledgeMarketplaceValidator {
  readonly name = "category";

  validate(input: KnowledgeMarketplaceValidationInput): MarketplaceValidationResult {
    const issues: MarketplaceValidationIssue[] = [];
    if (input.categoryResolvable === false) {
      issues.push({
        path: "metadata.category",
        message: `Category "${input.metadata.category}" did not resolve against the Category Registry`,
      });
    }
    return { valid: issues.length === 0, issues };
  }
}
